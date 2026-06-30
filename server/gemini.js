import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const PRIMARY = "gemini-2.5-flash";
const FALLBACK = "gemini-2.5-flash-lite";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Run a request, retrying with backoff on overload (503/429) and finally
// falling back to a lighter model so demand spikes don't break the flow.
async function withRetry(makeRequest, { retries = 3 } = {}) {
  for (const name of [PRIMARY, FALLBACK]) {
    const model = genAI.getGenerativeModel({ model: name });
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await makeRequest(model);
      } catch (e) {
        const overloaded = e?.status === 503 || e?.status === 429;
        if (!overloaded) throw e;
        if (attempt === retries) break; // exhausted; try fallback model
        await sleep(700 * (attempt + 1));
      }
    }
  }
  throw new Error("Gemini is busy right now. Please try again in a moment.");
}

function extractJson(raw) {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in model response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Transcribe spoken audio with Gemini (works regardless of browser support).
export async function transcribeAudio(buffer, mimeType) {
  const res = await withRetry((model) =>
    model.generateContent([
      { text: "Transcribe this spoken English audio verbatim. Return only the transcript text, nothing else." },
      { inlineData: { data: buffer.toString("base64"), mimeType: mimeType || "audio/webm" } },
    ])
  );
  return res.response.text().trim();
}

// Part 2 is the "long turn": the candidate must speak alone for 1–2 minutes from a cue
// card. The four criteria are unchanged, but the evidence weighed differs — Fluency &
// Coherence dominates (sustaining a long, well-organised monologue) and answer length
// matters far more than in the short Part 1/Part 3 exchanges.
function part2Criteria(wordCount) {
  // ~1.5–2 min of natural speech ≈ 180–300+ words. Flag clearly short long-turns.
  const tooShort = wordCount < 130;
  return `This is an IELTS Speaking PART 2 response (the "long turn"): the candidate speaks alone
for 1–2 minutes from a cue card, with no examiner support. Score the SAME four criteria, but weigh
the evidence as an examiner does for a monologue:
- Fluency & Coherence (MOST important here): can the candidate SUSTAIN speech at length without
  long pauses, excessive hesitation, or losing the thread? Reward a clear beginning–middle–end,
  logical sequencing, topic development with detail/examples, and a range of cohesive/discourse
  markers. Frequent breakdowns, drifting off-topic, or running out of things to say lower this.
- Lexical Resource: ability to paraphrase the cue-card topic and sustain topic-specific and
  idiomatic vocabulary across a longer stretch, not just a sentence or two.
- Grammatical Range & Accuracy: an extended turn should show a range of structures — especially
  narrative past tenses for "describe an experience/event" cue cards — and complex sentences.
- Pronunciation: estimate cautiously from text-based fluency cues only; assume intelligible, clear
  speech unless the transcript shows clear problems; cap at 7.

Length calibration (critical for Part 2):
- A full long turn is roughly 180–300+ words. ${tooShort
    ? `This answer is SHORT (${wordCount} words) for a 1–2 minute turn, so the candidate has not
  demonstrated the ability to sustain a long turn — cap Fluency & Coherence at about 6.0 and note
  the brevity, even if the language used is accurate.`
    : `This answer is a reasonable length (${wordCount} words) for the long turn, so do not penalise
  length — judge how well the turn is sustained and organised.`}
- Do NOT reward padding/repetition: filling time with empty repetition is not the same as
  developing ideas, and should not raise the Fluency score.
- Overall = average of the four, rounded to nearest .5.
- Score off-topic, empty, or unintelligible answers ≤4.0.
- Justify with concrete, specific feedback (organisation, coverage of the cue-card prompts,
  examples used), not generic praise.`;
}

function part1Criteria() {
  return `This is an IELTS Speaking PART 1/PART 3 response (short interview/discussion exchange).
Apply official IELTS band descriptors per criterion (0–9, .5 steps):
- Fluency & Coherence: speaks at length with logical flow; some repetition/self-correction is
  normal and acceptable at Band 6. Reserve low scores for frequent breakdowns that impede meaning.
- Lexical Resource: range and appropriacy. Using common vocabulary accurately and relevantly,
  with some flexibility, is Band 6. Only mark down for limited range that restricts meaning.
- Grammatical Range & Accuracy: a mix of simple and complex structures with errors that rarely
  cause comprehension problems is Band 6. Frequent errors that obscure meaning score lower.
- Pronunciation: estimate cautiously from text-based fluency cues only (audio not given). Assume
  intelligible, clear speech unless the transcript shows clear problems; cap at 7.

Calibration guidance:
- Band 6 = generally effective use of English with some inaccuracies/inappropriacies; meaning
  is clear throughout. This is the typical level for relevant, coherent, accurate everyday answers.
- Band 7+ = sustained, flexible, idiomatic language with only occasional errors.
- A relevant, grammatically accurate, on-topic short answer should still score around 6 on
  Lexical and Grammar; only Fluency may dip for very brief responses, not below 5.5 if fluent.
- Score off-topic, empty, or unintelligible answers ≤4.0.
- Overall = average of the four, rounded to nearest .5.
- Justify with concrete, specific feedback, not generic praise.`;
}

export async function scoreAnswer(question, transcript, part = 1) {
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  const isPart2 = Number(part) === 2;
  const criteria = isPart2 ? part2Criteria(wordCount) : part1Criteria();
  const modelAnswerGuide = isPart2
    ? "an upgraded band-8 version of the STUDENT'S OWN long-turn answer above: keep their ideas, examples and personal details, but rewrite it with richer vocabulary, more accurate and varied grammar, and smoother organisation; natural and spoken, ~150-200 words covering the cue card"
    : "an upgraded band-8 version of the STUDENT'S OWN answer above: keep their ideas and personal details, but rewrite it with richer vocabulary, more accurate and varied grammar, and smoother fluency; natural and spoken, 3-5 sentences";
  const prompt = `You are a fair, certified IELTS speaking examiner. Apply the official band
descriptors accurately — neither inflating nor deflating scores. Reward what the candidate does
well and only penalise genuine, observable weaknesses. A clear, accurate, relevant answer with
some range of vocabulary and grammar is a solid Band 6; do not under-score competent responses.

Question / cue card: "${question}"
Student's answer (auto-transcribed; ${wordCount} words): "${transcript}"

${criteria}

Reply with ONLY valid JSON:
{
  "encouragement": "one honest but supportive sentence",
  "score": { "fluency": 5.5, "lexical": 5.5, "grammar": 5.5, "pronunciation": 5.5, "overall": 5.5 },
  "strengths": ["2-3 specific bullets"],
  "improvements": ["2-3 actionable tips"],
  "enhancedAnswer": "${modelAnswerGuide}. Build directly on what the student actually said — do NOT invent a generic answer on a different topic or with unrelated content.",
  "vocabulary": [
    {"phrase": "a useful collocation or idiom for this topic", "meaning": "short, plain-English meaning"}
  ]
}
For "vocabulary", give 3-4 band-7+ collocations, idioms or topic phrases relevant to this question
that the student could realistically reuse; keep each meaning to a short plain-English phrase.`;
  const res = await withRetry((model) => model.generateContent(prompt));
  return extractJson(res.response.text());
}

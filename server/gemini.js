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

export async function scoreAnswer(question, transcript) {
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  const prompt = `You are a fair, certified IELTS speaking examiner. Apply the official band
descriptors accurately — neither inflating nor deflating scores. Reward what the candidate does
well and only penalise genuine, observable weaknesses. A clear, accurate, relevant answer with
some range of vocabulary and grammar is a solid Band 6; do not under-score competent responses.

Question: "${question}"
Student's answer (auto-transcribed; ${wordCount} words): "${transcript}"

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
- Justify with concrete, specific feedback, not generic praise.

Reply with ONLY valid JSON:
{
  "encouragement": "one honest but supportive sentence",
  "score": { "fluency": 5.5, "lexical": 5.5, "grammar": 5.5, "pronunciation": 5.5, "overall": 5.5 },
  "strengths": ["2-3 specific bullets"],
  "improvements": ["2-3 actionable tips"],
  "enhancedAnswer": "a band-8 model answer, natural and spoken, 3-5 sentences"
}`;
  const res = await withRetry((model) => model.generateContent(prompt));
  return extractJson(res.response.text());
}

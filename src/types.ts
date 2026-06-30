export type IeltsPart = 1 | 2 | 3;

export interface Topic {
  id: string;
  season: string;
  title: string;
  part: IeltsPart;
  /** Part 1/3: list of questions. Part 2: cue card statement + follow-up prompts. */
  questions: string[];
}

export interface BandScore {
  fluency: number;
  lexical: number;
  grammar: number;
  pronunciation: number;
  overall: number;
}

export interface Feedback {
  encouragement: string;
  score: BandScore;
  strengths: string[];
  improvements: string[];
  enhancedAnswer: string;
  vocabulary?: { phrase: string; meaning: string }[];
}

export interface HistoryEntry {
  id: string;
  date: string;
  topicTitle: string;
  question: string;
  transcript: string;
  feedback: Feedback;
}

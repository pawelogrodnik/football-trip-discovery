const defaultQuestions = [
  { question: 'What sport uses a round ball and goals?', answer: 'football' },
  { question: 'What color is the sky on a clear day?', answer: 'blue' },
  { question: 'Type the last word of this sentence: stay awesome', answer: 'awesome' },
  { question: 'How many letters are in the word "code"?', answer: '4' },
  { question: 'Spell the word "fan" backwards.', answer: 'naf' },
];

export type SupportQuestion = {
  question: string;
  answer: string;
};

const fromEnv = () => {
  try {
    const raw = process.env.NEXT_PUBLIC_SUPPORT_FORM_QUESTIONS;
    if (!raw) {
      return defaultQuestions;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((q) => q?.question && q?.answer)) {
      return parsed as SupportQuestion[];
    }
    return defaultQuestions;
  } catch {
    return defaultQuestions;
  }
};

export const SUPPORT_FORM_QUESTIONS = fromEnv();

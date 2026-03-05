export type QuizResult = {
  correct: boolean;
  expectedAnswer: string;
};

export class QuizEngine {
  checkAnswer(answer: string, expectedAnswer: string): QuizResult {
    const correct = answer.trim().toLowerCase() === expectedAnswer.trim().toLowerCase();
    return { correct, expectedAnswer };
  }
}

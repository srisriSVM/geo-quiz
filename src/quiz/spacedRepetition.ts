export type ReviewPriority = "soon" | "normal" | "later";

export const getReviewPriority = (correctStreak: number, wasCorrect: boolean): ReviewPriority => {
  if (!wasCorrect) {
    return "soon";
  }

  if (correctStreak >= 3) {
    return "later";
  }

  return "normal";
};

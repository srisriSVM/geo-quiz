export const quizTypes = [
  "match_round_5",
  "identify_highlighted_typein",
  "identify_highlighted_mcq",
  "find_on_map",
  "capital_match",
  "neighbor_quiz",
  "rivers_seas_identify"
] as const;

export type QuizType = (typeof quizTypes)[number];

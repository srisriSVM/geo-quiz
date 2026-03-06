export type ProgressItem = {
  seenCount: number;
  correctCount: number;
  streak: number;
  lastSeen: number | null;
  lastResult: boolean | null;
};

const STORAGE_KEY = "geo-bee-trainer-progress";

export const loadProgress = (): Record<string, ProgressItem> => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, ProgressItem>;
  } catch {
    return {};
  }
};

export const saveProgress = (progress: Record<string, ProgressItem>): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
};

export const clearProgress = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

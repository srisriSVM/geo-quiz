import type { Pack } from "../data/types";
import type { QuizType } from "../quiz/quizTypes";

type HudActions = {
  onModeChange: (mode: "learn" | "quiz") => void;
  onPackChange: (packId: string) => void;
  onQuizTypeChange: (quizType: QuizType) => void;
  onHint: () => void;
  onReveal: () => void;
  onNext: () => void;
};

type HudStats = {
  score: number;
  streak: number;
  progress: string;
};

export class Hud {
  readonly root: HTMLElement;

  private readonly modeSelect: HTMLSelectElement;
  private readonly packSelect: HTMLSelectElement;
  private readonly quizTypeSelect: HTMLSelectElement;
  private readonly scoreEl: HTMLElement;
  private readonly streakEl: HTMLElement;
  private readonly progressEl: HTMLElement;

  constructor(packs: Pack[], actions: HudActions) {
    this.root = document.createElement("header");
    this.root.className = "hud";

    this.root.innerHTML = `
      <div class="hud-row">
        <label>
          Mode
          <select aria-label="Mode" data-role="mode">
            <option value="learn">Learn</option>
            <option value="quiz">Quiz</option>
          </select>
        </label>
        <label>
          Pack
          <select aria-label="Pack" data-role="pack"></select>
        </label>
        <label>
          Quiz Type
          <select aria-label="Quiz Type" data-role="quiz-type">
            <option value="identify_highlighted_typein">Identify Highlighted</option>
          </select>
        </label>
      </div>
      <div class="hud-row">
        <span data-role="score">Score: 0</span>
        <span data-role="streak">Streak: 0</span>
        <span data-role="progress">Progress: 0 / 0</span>
        <button type="button" data-role="hint">Hint</button>
        <button type="button" data-role="reveal">Reveal</button>
        <button type="button" data-role="next">Next</button>
      </div>
    `;

    this.modeSelect = this.query<HTMLSelectElement>("[data-role='mode']");
    this.packSelect = this.query<HTMLSelectElement>("[data-role='pack']");
    this.quizTypeSelect = this.query<HTMLSelectElement>("[data-role='quiz-type']");
    this.scoreEl = this.query<HTMLElement>("[data-role='score']");
    this.streakEl = this.query<HTMLElement>("[data-role='streak']");
    this.progressEl = this.query<HTMLElement>("[data-role='progress']");

    for (const pack of packs) {
      const option = document.createElement("option");
      option.value = pack.id;
      option.textContent = pack.name;
      this.packSelect.append(option);
    }

    this.modeSelect.addEventListener("change", () => {
      actions.onModeChange(this.modeSelect.value === "quiz" ? "quiz" : "learn");
    });

    this.packSelect.addEventListener("change", () => {
      actions.onPackChange(this.packSelect.value);
    });

    this.quizTypeSelect.addEventListener("change", () => {
      actions.onQuizTypeChange(this.quizTypeSelect.value as QuizType);
    });

    this.query<HTMLButtonElement>("[data-role='hint']").addEventListener("click", actions.onHint);
    this.query<HTMLButtonElement>("[data-role='reveal']").addEventListener("click", actions.onReveal);
    this.query<HTMLButtonElement>("[data-role='next']").addEventListener("click", actions.onNext);
  }

  setMode(mode: "learn" | "quiz"): void {
    this.modeSelect.value = mode;
  }

  setPack(packId: string): void {
    this.packSelect.value = packId;
  }

  setStats(stats: HudStats): void {
    this.scoreEl.textContent = `Score: ${stats.score}`;
    this.streakEl.textContent = `Streak: ${stats.streak}`;
    this.progressEl.textContent = `Progress: ${stats.progress}`;
  }

  private query<T extends HTMLElement>(selector: string): T {
    const el = this.root.querySelector<T>(selector);
    if (!el) {
      throw new Error(`Missing HUD element ${selector}`);
    }

    return el;
  }
}

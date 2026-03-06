import type { Pack } from "../data/types";
import type { QuizType } from "../quiz/quizTypes";

type HudActions = {
  onModeChange: (mode: "learn" | "quiz") => void;
  onPackChange: (packId: string) => void;
  onQuizTypeChange: (quizType: QuizType) => void;
  onMapDetailChange: (
    mapDetail: "quiz_clean" | "reference_full" | "physical_basic" | "physical_relief"
  ) => void;
  onLowDataModeChange: (enabled: boolean) => void;
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
  private readonly mapDetailSelect: HTMLSelectElement;
  private readonly lowDataCheckbox: HTMLInputElement;
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
        <label>
          Map Detail
          <select aria-label="Map Detail" data-role="map-detail">
            <option value="quiz_clean">Quiz Clean</option>
            <option value="reference_full">Reference Full</option>
            <option value="physical_basic">Physical Basic</option>
            <option value="physical_relief">Physical Relief</option>
          </select>
        </label>
        <label style="display: flex; align-items: center; gap: 6px;">
          <input type="checkbox" data-role="low-data" />
          Low Data
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
    this.mapDetailSelect = this.query<HTMLSelectElement>("[data-role='map-detail']");
    this.lowDataCheckbox = this.query<HTMLInputElement>("[data-role='low-data']");
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
    this.mapDetailSelect.addEventListener("change", () => {
      actions.onMapDetailChange(
        this.mapDetailSelect.value as
          | "quiz_clean"
          | "reference_full"
          | "physical_basic"
          | "physical_relief"
      );
    });
    this.lowDataCheckbox.addEventListener("change", () => {
      actions.onLowDataModeChange(this.lowDataCheckbox.checked);
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

  setMapDetail(
    mapDetail: "quiz_clean" | "reference_full" | "physical_basic" | "physical_relief"
  ): void {
    this.mapDetailSelect.value = mapDetail;
  }

  setLowDataMode(enabled: boolean): void {
    this.lowDataCheckbox.checked = enabled;
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

import type { Difficulty, Pack } from "../data/types";
import type { QuizType } from "../quiz/quizTypes";

const SETTINGS_OPEN_KEY = "geo-bee-settings-open";

type HudActions = {
  onModeChange: (mode: "learn" | "quiz") => void;
  onPackChange: (packId: string) => void;
  onQuizTypeChange: (quizType: QuizType) => void;
  onMapDetailChange: (
    mapDetail: "quiz_clean" | "reference_full" | "physical_basic" | "physical_relief"
  ) => void;
  onLowDataModeChange: (enabled: boolean) => void;
  onDifficultyFilterChange: (difficulties: Difficulty[]) => void;
  onResetProgress: () => void;
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

  private readonly hudPillEl: HTMLElement;
  private readonly modeSelect: HTMLSelectElement;
  private readonly packSelect: HTMLSelectElement;
  private readonly quizTypeSelect: HTMLSelectElement;
  private readonly mapDetailSelect: HTMLSelectElement;
  private readonly lowDataCheckbox: HTMLInputElement;
  private readonly difficultyEasyCheckbox: HTMLInputElement;
  private readonly difficultyMediumCheckbox: HTMLInputElement;
  private readonly difficultyHardCheckbox: HTMLInputElement;
  private readonly difficultyAllButton: HTMLButtonElement;
  private readonly summaryEl: HTMLElement;
  private readonly hintButton: HTMLButtonElement;
  private readonly revealButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly settingsPanel: HTMLElement;
  private readonly settingsToggleButton: HTMLButtonElement;
  private readonly settingsCloseButton: HTMLButtonElement;
  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  constructor(packs: Pack[], actions: HudActions) {
    this.root = document.createElement("header");
    this.root.className = "hud";

    this.root.innerHTML = `
      <div class="hud-pill" data-role="hud-pill">
        <label class="hud-mode-label">
          <span>Mode</span>
          <select aria-label="Mode" data-role="mode">
            <option value="learn">Learn</option>
            <option value="quiz">Quiz</option>
          </select>
        </label>
        <span data-role="summary" class="hud-summary">Progress: 0 / 0</span>
        <div class="hud-context-actions">
          <button type="button" data-role="hint">Hint</button>
          <button type="button" data-role="reveal">Reveal</button>
          <button type="button" data-role="next">Next</button>
          <button type="button" data-role="settings-toggle" class="hud-settings-toggle" aria-label="Open settings">
            ⚙ Settings
          </button>
        </div>
      </div>
      <aside data-role="settings-panel" class="hud-settings-panel" hidden>
        <div class="hud-settings-header">
          <strong>Settings</strong>
          <button type="button" data-role="settings-close" aria-label="Close settings">Hide</button>
        </div>
        <label>
          Pack
          <select aria-label="Pack" data-role="pack"></select>
        </label>
        <label>
          Quiz Type
          <select aria-label="Quiz Type" data-role="quiz-type">
            <option value="match_round_5">Match Round (5)</option>
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
        <div class="difficulty-filter-group" data-role="difficulty-group" aria-label="Difficulty filter">
          <span>Difficulty</span>
          <label><input type="checkbox" data-role="difficulty-easy" checked />Easy</label>
          <label><input type="checkbox" data-role="difficulty-medium" checked />Medium</label>
          <label><input type="checkbox" data-role="difficulty-hard" checked />Hard</label>
          <button type="button" data-role="difficulty-all">All</button>
        </div>
        <button type="button" data-role="reset-progress">Reset Progress</button>
      </aside>
    `;

    this.hudPillEl = this.query<HTMLElement>("[data-role='hud-pill']");
    this.modeSelect = this.query<HTMLSelectElement>("[data-role='mode']");
    this.packSelect = this.query<HTMLSelectElement>("[data-role='pack']");
    this.quizTypeSelect = this.query<HTMLSelectElement>("[data-role='quiz-type']");
    this.mapDetailSelect = this.query<HTMLSelectElement>("[data-role='map-detail']");
    this.lowDataCheckbox = this.query<HTMLInputElement>("[data-role='low-data']");
    this.difficultyEasyCheckbox = this.query<HTMLInputElement>("[data-role='difficulty-easy']");
    this.difficultyMediumCheckbox = this.query<HTMLInputElement>("[data-role='difficulty-medium']");
    this.difficultyHardCheckbox = this.query<HTMLInputElement>("[data-role='difficulty-hard']");
    this.difficultyAllButton = this.query<HTMLButtonElement>("[data-role='difficulty-all']");
    this.summaryEl = this.query<HTMLElement>("[data-role='summary']");
    this.hintButton = this.query<HTMLButtonElement>("[data-role='hint']");
    this.revealButton = this.query<HTMLButtonElement>("[data-role='reveal']");
    this.nextButton = this.query<HTMLButtonElement>("[data-role='next']");
    this.settingsPanel = this.query<HTMLElement>("[data-role='settings-panel']");
    this.settingsToggleButton = this.query<HTMLButtonElement>("[data-role='settings-toggle']");
    this.settingsCloseButton = this.query<HTMLButtonElement>("[data-role='settings-close']");

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
    this.difficultyEasyCheckbox.addEventListener("change", () => this.emitDifficultyFilter(actions));
    this.difficultyMediumCheckbox.addEventListener("change", () => this.emitDifficultyFilter(actions));
    this.difficultyHardCheckbox.addEventListener("change", () => this.emitDifficultyFilter(actions));
    this.difficultyAllButton.addEventListener("click", () => {
      this.setDifficultyFilter(["easy", "medium", "hard"]);
      actions.onDifficultyFilterChange(["easy", "medium", "hard"]);
    });
    this.settingsToggleButton.addEventListener("click", () => this.setSettingsPanelOpen(true));
    this.settingsCloseButton.addEventListener("click", () => this.setSettingsPanelOpen(false));

    this.hintButton.addEventListener("click", actions.onHint);
    this.revealButton.addEventListener("click", actions.onReveal);
    this.nextButton.addEventListener("click", actions.onNext);
    this.query<HTMLButtonElement>("[data-role='reset-progress']").addEventListener("click", actions.onResetProgress);

    this.setSettingsPanelOpen(localStorage.getItem(SETTINGS_OPEN_KEY) === "1");

    this.hudPillEl.addEventListener("pointerdown", (event) => {
      const target = event.target as HTMLElement | null;
      if (!target || this.isInteractiveTarget(target)) {
        return;
      }
      const rect = this.root.getBoundingClientRect();
      this.root.style.right = "auto";
      this.root.style.transform = "none";
      this.root.style.left = `${rect.left}px`;
      this.root.style.top = `${rect.top}px`;
      this.dragging = true;
      this.dragOffsetX = event.clientX - rect.left;
      this.dragOffsetY = event.clientY - rect.top;
      this.hudPillEl.setPointerCapture(event.pointerId);
      this.hudPillEl.classList.add("hud-pill--dragging");
    });

    this.hudPillEl.addEventListener("pointermove", (event) => {
      if (!this.dragging) {
        return;
      }
      const rect = this.root.getBoundingClientRect();
      const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
      const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
      const left = Math.min(Math.max(8, event.clientX - this.dragOffsetX), maxLeft);
      const top = Math.min(Math.max(8, event.clientY - this.dragOffsetY), maxTop);
      this.root.style.left = `${left}px`;
      this.root.style.top = `${top}px`;
    });

    const stopDrag = (pointerId?: number): void => {
      if (!this.dragging) {
        return;
      }
      this.dragging = false;
      this.hudPillEl.classList.remove("hud-pill--dragging");
      if (typeof pointerId === "number" && this.hudPillEl.hasPointerCapture(pointerId)) {
        this.hudPillEl.releasePointerCapture(pointerId);
      }
    };

    this.hudPillEl.addEventListener("pointerup", (event) => stopDrag(event.pointerId));
    this.hudPillEl.addEventListener("pointercancel", (event) => stopDrag(event.pointerId));
  }

  setMode(mode: "learn" | "quiz"): void {
    this.modeSelect.value = mode;
    const inQuiz = mode === "quiz";
    this.hintButton.style.display = inQuiz ? "inline-block" : "none";
    this.revealButton.style.display = inQuiz ? "inline-block" : "none";
    this.nextButton.style.display = inQuiz ? "none" : "inline-block";
  }

  setPack(packId: string): void {
    this.packSelect.value = packId;
  }

  setQuizType(quizType: QuizType): void {
    this.quizTypeSelect.value = quizType;
  }

  setMapDetail(
    mapDetail: "quiz_clean" | "reference_full" | "physical_basic" | "physical_relief"
  ): void {
    this.mapDetailSelect.value = mapDetail;
  }

  setLowDataMode(enabled: boolean): void {
    this.lowDataCheckbox.checked = enabled;
  }

  setDifficultyFilter(difficulties: Difficulty[]): void {
    this.difficultyEasyCheckbox.checked = difficulties.includes("easy");
    this.difficultyMediumCheckbox.checked = difficulties.includes("medium");
    this.difficultyHardCheckbox.checked = difficulties.includes("hard");
  }

  setStats(stats: HudStats): void {
    this.summaryEl.textContent = `${stats.progress} | Score ${stats.score} | Streak ${stats.streak}`;
  }

  private query<T extends HTMLElement>(selector: string): T {
    const el = this.root.querySelector<T>(selector);
    if (!el) {
      throw new Error(`Missing HUD element ${selector}`);
    }

    return el;
  }

  private emitDifficultyFilter(actions: HudActions): void {
    const difficulties: Difficulty[] = [];
    if (this.difficultyEasyCheckbox.checked) {
      difficulties.push("easy");
    }
    if (this.difficultyMediumCheckbox.checked) {
      difficulties.push("medium");
    }
    if (this.difficultyHardCheckbox.checked) {
      difficulties.push("hard");
    }
    if (difficulties.length === 0) {
      this.setDifficultyFilter(["easy", "medium", "hard"]);
      actions.onDifficultyFilterChange(["easy", "medium", "hard"]);
      return;
    }
    actions.onDifficultyFilterChange(difficulties);
  }

  private setSettingsPanelOpen(open: boolean): void {
    this.settingsPanel.hidden = !open;
    this.settingsToggleButton.style.display = open ? "none" : "inline-block";
    localStorage.setItem(SETTINGS_OPEN_KEY, open ? "1" : "0");
  }

  private isInteractiveTarget(target: HTMLElement): boolean {
    return Boolean(target.closest("button, input, select, textarea, label, a"));
  }
}

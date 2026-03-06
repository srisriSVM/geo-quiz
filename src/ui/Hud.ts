import type { Difficulty, Pack } from "../data/types";
import type { QuizType } from "../quiz/quizTypes";

const SETTINGS_OPEN_KEY = "geo-bee-settings-open";

type HudActions = {
  onModeChange: (mode: "learn" | "quiz") => void;
  onPackChange: (packId: string) => void;
  onQuizTypeChange: (quizType: QuizType) => void;
  onMapDetailChange: (
    mapDetail:
      | "quiz_clean"
      | "reference_full"
      | "physical_basic"
      | "physical_relief"
      | "dark_quiz"
      | "monochrome"
      | "satellite"
      | "night_lights"
  ) => void;
  onLowDataModeChange: (enabled: boolean) => void;
  onPolygonVisibilityChange: (enabled: boolean) => void;
  onDifficultyFilterChange: (difficulties: Difficulty[]) => void;
  onResetProgress: () => void;
  onHint: () => void;
  onReveal: () => void;
  onNext: () => void;
  onEntitySearch: (query: string) => void;
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
  private readonly polygonCheckbox: HTMLInputElement;
  private readonly difficultyEasyCheckbox: HTMLInputElement;
  private readonly difficultyMediumCheckbox: HTMLInputElement;
  private readonly difficultyHardCheckbox: HTMLInputElement;
  private readonly difficultyAllButton: HTMLButtonElement;
  private readonly entitySearchInput: HTMLInputElement;
  private readonly entitySearchButton: HTMLButtonElement;
  private readonly entitySearchDatalist: HTMLDataListElement;
  private readonly summaryEl: HTMLElement;
  private readonly hintButton: HTMLButtonElement;
  private readonly revealButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly settingsPanel: HTMLElement;
  private readonly settingsToggleButton: HTMLButtonElement;
  private readonly settingsCloseButton: HTMLButtonElement;
  private readonly settingsDragHandleEl: HTMLElement;
  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private settingsDragging = false;
  private settingsDragOffsetX = 0;
  private settingsDragOffsetY = 0;

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
        <div class="hud-settings-header" data-role="settings-drag-handle">
          <strong>Settings</strong>
          <button type="button" data-role="settings-close" aria-label="Close settings">Hide</button>
        </div>
        <label>
          Pack
          <select aria-label="Pack" data-role="pack"></select>
        </label>
        <label>
          Search Entity
          <div class="hud-search-row">
            <input type="text" data-role="entity-search" list="entity-search-list" placeholder="Type a name..." />
            <button type="button" data-role="entity-search-go">Go</button>
          </div>
          <datalist id="entity-search-list" data-role="entity-search-list"></datalist>
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
            <option value="dark_quiz">Dark Quiz</option>
            <option value="monochrome">Monochrome</option>
            <option value="satellite">Satellite</option>
            <option value="night_lights">Night Lights</option>
          </select>
        </label>
        <label style="display: flex; align-items: center; gap: 6px;">
          <input type="checkbox" data-role="low-data" />
          Low Data
        </label>
        <label style="display: flex; align-items: center; gap: 6px;">
          <input type="checkbox" data-role="show-polygons" checked />
          Show Polygons
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
    this.polygonCheckbox = this.query<HTMLInputElement>("[data-role='show-polygons']");
    this.difficultyEasyCheckbox = this.query<HTMLInputElement>("[data-role='difficulty-easy']");
    this.difficultyMediumCheckbox = this.query<HTMLInputElement>("[data-role='difficulty-medium']");
    this.difficultyHardCheckbox = this.query<HTMLInputElement>("[data-role='difficulty-hard']");
    this.difficultyAllButton = this.query<HTMLButtonElement>("[data-role='difficulty-all']");
    this.entitySearchInput = this.query<HTMLInputElement>("[data-role='entity-search']");
    this.entitySearchButton = this.query<HTMLButtonElement>("[data-role='entity-search-go']");
    this.entitySearchDatalist = this.query<HTMLDataListElement>("[data-role='entity-search-list']");
    this.summaryEl = this.query<HTMLElement>("[data-role='summary']");
    this.hintButton = this.query<HTMLButtonElement>("[data-role='hint']");
    this.revealButton = this.query<HTMLButtonElement>("[data-role='reveal']");
    this.nextButton = this.query<HTMLButtonElement>("[data-role='next']");
    this.settingsPanel = this.query<HTMLElement>("[data-role='settings-panel']");
    this.settingsToggleButton = this.query<HTMLButtonElement>("[data-role='settings-toggle']");
    this.settingsCloseButton = this.query<HTMLButtonElement>("[data-role='settings-close']");
    this.settingsDragHandleEl = this.query<HTMLElement>("[data-role='settings-drag-handle']");

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
          | "dark_quiz"
          | "monochrome"
          | "satellite"
          | "night_lights"
      );
    });
    this.lowDataCheckbox.addEventListener("change", () => {
      actions.onLowDataModeChange(this.lowDataCheckbox.checked);
    });
    this.polygonCheckbox.addEventListener("change", () => {
      actions.onPolygonVisibilityChange(this.polygonCheckbox.checked);
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
    this.entitySearchButton.addEventListener("click", () => {
      actions.onEntitySearch(this.entitySearchInput.value.trim());
    });
    this.entitySearchInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      actions.onEntitySearch(this.entitySearchInput.value.trim());
    });

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

    this.settingsDragHandleEl.addEventListener("pointerdown", (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("button")) {
        return;
      }
      const rootRect = this.root.getBoundingClientRect();
      const panelRect = this.settingsPanel.getBoundingClientRect();
      this.settingsPanel.style.right = "auto";
      this.settingsPanel.style.bottom = "auto";
      this.settingsPanel.style.left = `${panelRect.left - rootRect.left}px`;
      this.settingsPanel.style.top = `${panelRect.top - rootRect.top}px`;

      this.settingsDragging = true;
      this.settingsDragOffsetX = event.clientX - panelRect.left;
      this.settingsDragOffsetY = event.clientY - panelRect.top;
      this.settingsDragHandleEl.setPointerCapture(event.pointerId);
      this.settingsDragHandleEl.classList.add("hud-settings-header--dragging");
    });

    this.settingsDragHandleEl.addEventListener("pointermove", (event) => {
      if (!this.settingsDragging) {
        return;
      }
      const rootRect = this.root.getBoundingClientRect();
      const panelRect = this.settingsPanel.getBoundingClientRect();
      const maxLeft = Math.max(8, window.innerWidth - panelRect.width - 8);
      const maxTop = Math.max(8, window.innerHeight - panelRect.height - 8);
      const viewportLeft = Math.min(Math.max(8, event.clientX - this.settingsDragOffsetX), maxLeft);
      const viewportTop = Math.min(Math.max(8, event.clientY - this.settingsDragOffsetY), maxTop);
      this.settingsPanel.style.left = `${viewportLeft - rootRect.left}px`;
      this.settingsPanel.style.top = `${viewportTop - rootRect.top}px`;
    });

    const stopSettingsDrag = (pointerId?: number): void => {
      if (!this.settingsDragging) {
        return;
      }
      this.settingsDragging = false;
      this.settingsDragHandleEl.classList.remove("hud-settings-header--dragging");
      if (typeof pointerId === "number" && this.settingsDragHandleEl.hasPointerCapture(pointerId)) {
        this.settingsDragHandleEl.releasePointerCapture(pointerId);
      }
    };
    this.settingsDragHandleEl.addEventListener("pointerup", (event) => stopSettingsDrag(event.pointerId));
    this.settingsDragHandleEl.addEventListener("pointercancel", (event) => stopSettingsDrag(event.pointerId));
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
    mapDetail:
      | "quiz_clean"
      | "reference_full"
      | "physical_basic"
      | "physical_relief"
      | "dark_quiz"
      | "monochrome"
      | "satellite"
      | "night_lights"
  ): void {
    this.mapDetailSelect.value = mapDetail;
  }

  setLowDataMode(enabled: boolean): void {
    this.lowDataCheckbox.checked = enabled;
  }

  setPolygonVisibility(enabled: boolean): void {
    this.polygonCheckbox.checked = enabled;
  }

  setDifficultyFilter(difficulties: Difficulty[]): void {
    this.difficultyEasyCheckbox.checked = difficulties.includes("easy");
    this.difficultyMediumCheckbox.checked = difficulties.includes("medium");
    this.difficultyHardCheckbox.checked = difficulties.includes("hard");
  }

  setEntitySearchOptions(items: string[]): void {
    this.entitySearchDatalist.innerHTML = "";
    const seen = new Set<string>();
    for (const item of items) {
      const value = item.trim();
      if (!value || seen.has(value)) {
        continue;
      }
      seen.add(value);
      const option = document.createElement("option");
      option.value = value;
      this.entitySearchDatalist.append(option);
    }
  }

  clearEntitySearch(): void {
    this.entitySearchInput.value = "";
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

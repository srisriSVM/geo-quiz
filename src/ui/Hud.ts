import type { Difficulty, Pack } from "../data/types";
import type { QuizType } from "../quiz/quizTypes";
import type { TargetMarkerColor, TargetMarkerShape } from "../map/MapView";

const SETTINGS_OPEN_KEY = "geo-bee-settings-open";
const ALL_REGIONS_VALUE = "__all_regions__";

type HudActions = {
  onModeChange: (mode: "learn" | "quiz") => void;
  onPackChange: (packId: string) => void;
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
  onKnowFromHud: () => void;
  onPracticeFromHud: () => void;
  onRepeatFromHud: () => void;
  onShowLearnDetails: () => void;
  onEntitySearch: (query: string) => void;
  onTargetMarkerShapeChange: (shape: TargetMarkerShape) => void;
  onTargetMarkerColorChange: (color: TargetMarkerColor) => void;
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
  private readonly regionSelect: HTMLSelectElement;
  private readonly packSelect: HTMLSelectElement;
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
  private readonly targetMarkerPreview: HTMLElement;
  private readonly targetMarkerShapeButtons: HTMLButtonElement[];
  private readonly targetMarkerColorButtons: HTMLButtonElement[];
  private readonly summaryEl: HTMLElement;
  private readonly hintButton: HTMLButtonElement;
  private readonly revealButton: HTMLButtonElement;
  private readonly learnKnownButton: HTMLButtonElement;
  private readonly learnPracticeButton: HTMLButtonElement;
  private readonly learnRepeatButton: HTMLButtonElement;
  private readonly learnNextButton: HTMLButtonElement;
  private readonly quickSearchButton: HTMLButtonElement;
  private readonly detailToggleButton: HTMLButtonElement;
  private readonly settingsPanel: HTMLElement;
  private readonly settingsToggleButton: HTMLButtonElement;
  private readonly settingsCloseButton: HTMLButtonElement;
  private readonly settingsDragHandleEl: HTMLElement;
  private readonly packs: Pack[];
  private selectedRegion = ALL_REGIONS_VALUE;
  private mode: "learn" | "quiz" = "learn";
  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private settingsDragging = false;
  private settingsDragOffsetX = 0;
  private settingsDragOffsetY = 0;
  private settingsOpen = false;

  constructor(packs: Pack[], actions: HudActions) {
    this.packs = packs;
    this.root = document.createElement("header");
    this.root.className = "hud";

    this.root.innerHTML = `
      <div class="hud-pill" data-role="hud-pill">
        <label class="hud-mode-label">
          <select aria-label="Mode" data-role="mode">
            <option value="learn">Learn</option>
            <option value="quiz">Quiz</option>
          </select>
        </label>
        <span data-role="summary" class="hud-summary">Progress: 0 / 0</span>
        <div class="hud-context-actions">
          <button type="button" data-role="hint">Hint</button>
          <button type="button" data-role="reveal">Reveal</button>
          <button type="button" data-role="learn-known" class="hud-learn-btn hud-learn-btn--known" aria-label="Known">✅</button>
          <button type="button" data-role="learn-practice" class="hud-learn-btn hud-learn-btn--practice" aria-label="Needs practice">🟡</button>
          <button type="button" data-role="learn-repeat" class="hud-learn-btn hud-learn-btn--repeat" aria-label="Repeat now">🔁</button>
          <button type="button" data-role="learn-next" class="hud-learn-btn hud-learn-btn--next" aria-label="Next">➡️</button>
          <button type="button" data-role="quick-search" class="hud-learn-btn hud-learn-btn--search" aria-label="Search">🔎</button>
          <button type="button" data-role="detail-toggle">Show Detail</button>
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
          Region
          <select aria-label="Region" data-role="region"></select>
        </label>
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
        <label>
          Target Marker Shape
          <div class="hud-marker-picker-row" data-role="target-marker-shapes">
            <button type="button" class="hud-marker-shape-btn" data-shape="star">⭐ Star</button>
            <button type="button" class="hud-marker-shape-btn" data-shape="circle">● Circle</button>
            <button type="button" class="hud-marker-shape-btn" data-shape="diamond">◆ Diamond</button>
            <button type="button" class="hud-marker-shape-btn" data-shape="pin">📍 Pin</button>
            <button type="button" class="hud-marker-shape-btn" data-shape="triangle">▲ Triangle</button>
            <button type="button" class="hud-marker-shape-btn" data-shape="square">■ Square</button>
          </div>
        </label>
        <label>
          Target Marker Color
          <div class="hud-marker-picker-row" data-role="target-marker-colors">
            <button type="button" class="hud-marker-color-btn" data-color="cyan"><span class="hud-color-dot"></span>Cyan</button>
            <button type="button" class="hud-marker-color-btn" data-color="gold"><span class="hud-color-dot"></span>Gold</button>
            <button type="button" class="hud-marker-color-btn" data-color="pink"><span class="hud-color-dot"></span>Pink</button>
            <button type="button" class="hud-marker-color-btn" data-color="lime"><span class="hud-color-dot"></span>Lime</button>
            <button type="button" class="hud-marker-color-btn" data-color="violet"><span class="hud-color-dot"></span>Violet</button>
            <button type="button" class="hud-marker-color-btn" data-color="orange"><span class="hud-color-dot"></span>Orange</button>
            <button type="button" class="hud-marker-color-btn" data-color="teal"><span class="hud-color-dot"></span>Teal</button>
          </div>
        </label>
        <label>
          Preview
          <div class="hud-target-preview-wrap">
            <div data-role="target-marker-preview" class="hud-target-preview hud-target-preview--star"></div>
          </div>
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
    this.regionSelect = this.query<HTMLSelectElement>("[data-role='region']");
    this.packSelect = this.query<HTMLSelectElement>("[data-role='pack']");
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
    this.targetMarkerPreview = this.query<HTMLElement>("[data-role='target-marker-preview']");
    this.targetMarkerShapeButtons = Array.from(
      this.root.querySelectorAll<HTMLButtonElement>("[data-role='target-marker-shapes'] [data-shape]")
    );
    this.targetMarkerColorButtons = Array.from(
      this.root.querySelectorAll<HTMLButtonElement>("[data-role='target-marker-colors'] [data-color]")
    );
    this.summaryEl = this.query<HTMLElement>("[data-role='summary']");
    this.hintButton = this.query<HTMLButtonElement>("[data-role='hint']");
    this.revealButton = this.query<HTMLButtonElement>("[data-role='reveal']");
    this.learnKnownButton = this.query<HTMLButtonElement>("[data-role='learn-known']");
    this.learnPracticeButton = this.query<HTMLButtonElement>("[data-role='learn-practice']");
    this.learnRepeatButton = this.query<HTMLButtonElement>("[data-role='learn-repeat']");
    this.learnNextButton = this.query<HTMLButtonElement>("[data-role='learn-next']");
    this.quickSearchButton = this.query<HTMLButtonElement>("[data-role='quick-search']");
    this.detailToggleButton = this.query<HTMLButtonElement>("[data-role='detail-toggle']");
    this.settingsPanel = this.query<HTMLElement>("[data-role='settings-panel']");
    this.settingsToggleButton = this.query<HTMLButtonElement>("[data-role='settings-toggle']");
    this.settingsCloseButton = this.query<HTMLButtonElement>("[data-role='settings-close']");
    this.settingsDragHandleEl = this.query<HTMLElement>("[data-role='settings-drag-handle']");

    this.populateRegionOptions();
    this.rebuildPackOptions(this.packs[0]?.id);

    this.modeSelect.addEventListener("change", () => {
      actions.onModeChange(this.modeSelect.value === "quiz" ? "quiz" : "learn");
    });

    this.regionSelect.addEventListener("change", () => {
      this.selectedRegion = this.regionSelect.value;
      const selectedPackId = this.rebuildPackOptions();
      if (selectedPackId) {
        actions.onPackChange(selectedPackId);
      }
    });

    this.packSelect.addEventListener("change", () => {
      actions.onPackChange(this.packSelect.value);
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
    for (const button of this.targetMarkerShapeButtons) {
      button.addEventListener("click", () => {
        const shape = button.dataset.shape as TargetMarkerShape | undefined;
        if (!shape) {
          return;
        }
        this.setTargetMarkerShape(shape);
        actions.onTargetMarkerShapeChange(shape);
      });
    }
    for (const button of this.targetMarkerColorButtons) {
      button.addEventListener("click", () => {
        const color = button.dataset.color as TargetMarkerColor | undefined;
        if (!color) {
          return;
        }
        this.setTargetMarkerColor(color);
        actions.onTargetMarkerColorChange(color);
      });
    }
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
    this.learnKnownButton.addEventListener("click", () => {
      this.ackLearnButton(this.learnKnownButton);
      actions.onKnowFromHud();
    });
    this.learnPracticeButton.addEventListener("click", () => {
      this.ackLearnButton(this.learnPracticeButton);
      actions.onPracticeFromHud();
    });
    this.learnRepeatButton.addEventListener("click", () => {
      this.ackLearnButton(this.learnRepeatButton);
      actions.onRepeatFromHud();
    });
    this.learnNextButton.addEventListener("click", () => {
      this.ackLearnButton(this.learnNextButton);
      actions.onNext();
    });
    this.quickSearchButton.addEventListener("click", () => {
      this.setSettingsPanelOpen(true);
      this.entitySearchInput.focus();
      this.entitySearchInput.select();
    });
    this.detailToggleButton.addEventListener("click", actions.onShowLearnDetails);
    this.query<HTMLButtonElement>("[data-role='reset-progress']").addEventListener("click", actions.onResetProgress);

    this.setSettingsPanelOpen(localStorage.getItem(SETTINGS_OPEN_KEY) === "1");

    this.hudPillEl.addEventListener("pointerdown", (event) => {
      const target = event.target as HTMLElement | null;
      if (!target || this.isInteractiveTarget(target)) {
        return;
      }
      const rect = this.root.getBoundingClientRect();
      this.root.style.right = "auto";
      this.root.style.bottom = "auto";
      this.root.style.transform = "none";
      this.root.style.width = `${rect.width}px`;
      this.root.style.left = `${rect.left}px`;
      this.root.style.top = `${rect.top}px`;
      this.root.classList.add("hud--dragging");
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
      this.root.classList.remove("hud--dragging");
      this.hudPillEl.classList.remove("hud-pill--dragging");
      if (typeof pointerId === "number" && this.hudPillEl.hasPointerCapture(pointerId)) {
        this.hudPillEl.releasePointerCapture(pointerId);
      }
      this.clampHudIntoViewport();
    };

    this.hudPillEl.addEventListener("pointerup", (event) => stopDrag(event.pointerId));
    this.hudPillEl.addEventListener("pointercancel", (event) => stopDrag(event.pointerId));
    this.hudPillEl.addEventListener("lostpointercapture", () => stopDrag());
    window.addEventListener("pointerup", () => stopDrag());
    window.addEventListener("resize", () => this.clampHudIntoViewport());
    window.addEventListener("orientationchange", () => this.clampHudIntoViewport());

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

    document.addEventListener("pointerdown", (event) => {
      if (!this.settingsOpen) {
        return;
      }
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (this.settingsPanel.contains(target) || this.settingsToggleButton.contains(target)) {
        return;
      }
      this.setSettingsPanelOpen(false);
    });
  }

  setMode(mode: "learn" | "quiz"): void {
    this.mode = mode;
    this.modeSelect.value = mode;
    const inQuiz = mode === "quiz";
    this.hintButton.style.display = inQuiz ? "inline-block" : "none";
    this.revealButton.style.display = inQuiz ? "inline-block" : "none";
    this.learnKnownButton.style.display = inQuiz ? "none" : "inline-block";
    this.learnPracticeButton.style.display = inQuiz ? "none" : "inline-block";
    this.learnRepeatButton.style.display = inQuiz ? "none" : "inline-block";
    this.learnNextButton.style.display = inQuiz ? "none" : "inline-block";
    this.quickSearchButton.style.display = inQuiz ? "none" : "inline-block";
    this.detailToggleButton.style.display = "none";
  }

  setPack(packId: string): void {
    const selectedPack = this.packs.find((pack) => pack.id === packId);
    if (!selectedPack) {
      return;
    }
    const isInCurrentRegion =
      this.selectedRegion === ALL_REGIONS_VALUE ||
      this.resolvePackGroup(selectedPack) === this.selectedRegion;
    if (!isInCurrentRegion) {
      this.selectedRegion = this.resolvePackGroup(selectedPack);
      this.regionSelect.value = this.selectedRegion;
      this.rebuildPackOptions(packId);
      return;
    }
    this.rebuildPackOptions(packId);
  }

  setQuizType(_quizType: QuizType): void {}

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

  setTargetMarkerShape(shape: TargetMarkerShape): void {
    for (const button of this.targetMarkerShapeButtons) {
      button.classList.toggle("is-active", button.dataset.shape === shape);
    }
    this.targetMarkerPreview.classList.remove(
      "hud-target-preview--star",
      "hud-target-preview--circle",
      "hud-target-preview--diamond",
      "hud-target-preview--pin",
      "hud-target-preview--triangle",
      "hud-target-preview--square"
    );
    this.targetMarkerPreview.classList.add(`hud-target-preview--${shape}`);
  }

  setTargetMarkerColor(color: TargetMarkerColor): void {
    for (const button of this.targetMarkerColorButtons) {
      const isActive = button.dataset.color === color;
      button.classList.toggle("is-active", isActive);
      const dot = button.querySelector<HTMLElement>(".hud-color-dot");
      if (dot) {
        dot.style.background = this.markerColorHex(button.dataset.color as TargetMarkerColor);
      }
    }
    this.targetMarkerPreview.style.setProperty("--preview-accent", this.markerColorHex(color));
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
    this.summaryEl.textContent = stats.progress;
  }

  setLearnDetailsHidden(hidden: boolean): void {
    this.detailToggleButton.style.display = this.mode === "learn" && hidden ? "inline-block" : "none";
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
    this.settingsOpen = open;
    this.settingsPanel.hidden = !open;
    this.settingsToggleButton.style.display = open ? "none" : "inline-block";
    localStorage.setItem(SETTINGS_OPEN_KEY, open ? "1" : "0");
  }

  private isInteractiveTarget(target: HTMLElement): boolean {
    return Boolean(target.closest("button, input, select, textarea, label, a"));
  }

  private ackLearnButton(button: HTMLButtonElement): void {
    button.classList.remove("hud-learn-btn--ack");
    void button.offsetWidth;
    button.classList.add("hud-learn-btn--ack");
    window.setTimeout(() => {
      button.classList.remove("hud-learn-btn--ack");
    }, 340);
  }

  private markerColorHex(color: TargetMarkerColor): string {
    switch (color) {
      case "gold":
        return "#f59e0b";
      case "pink":
        return "#ec4899";
      case "lime":
        return "#84cc16";
      case "violet":
        return "#8b5cf6";
      case "orange":
        return "#f97316";
      case "teal":
        return "#14b8a6";
      case "cyan":
      default:
        return "#22d3ee";
    }
  }

  private clampHudIntoViewport(): void {
    if (!this.root.style.left && !this.root.style.top) {
      return;
    }
    const rect = this.root.getBoundingClientRect();
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
      this.resetHudPosition();
      return;
    }
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
    const currentLeft = Number.parseFloat(this.root.style.left || `${rect.left}`);
    const currentTop = Number.parseFloat(this.root.style.top || `${rect.top}`);
    if (!Number.isFinite(currentLeft) || !Number.isFinite(currentTop)) {
      this.resetHudPosition();
      return;
    }
    this.root.style.right = "auto";
    this.root.style.bottom = "auto";
    this.root.style.transform = "none";
    this.root.style.left = `${Math.min(Math.max(8, currentLeft), maxLeft)}px`;
    this.root.style.top = `${Math.min(Math.max(8, currentTop), maxTop)}px`;
  }

  private resetHudPosition(): void {
    this.root.style.removeProperty("left");
    this.root.style.removeProperty("top");
    this.root.style.removeProperty("right");
    this.root.style.removeProperty("bottom");
    this.root.style.removeProperty("width");
    this.root.style.removeProperty("transform");
    this.root.classList.remove("hud--dragging");
  }

  private populateRegionOptions(): void {
    this.regionSelect.innerHTML = "";
    const optionAll = document.createElement("option");
    optionAll.value = ALL_REGIONS_VALUE;
    optionAll.textContent = "All Regions";
    this.regionSelect.append(optionAll);

    const preferredOrder = ["World", "US", "Canada", "India", "Europe", "Africa"];
    const regions = Array.from(new Set(this.packs.map((pack) => this.resolvePackGroup(pack))));
    regions.sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a);
      const bIndex = preferredOrder.indexOf(b);
      if (aIndex >= 0 && bIndex >= 0) {
        return aIndex - bIndex;
      }
      if (aIndex >= 0) {
        return -1;
      }
      if (bIndex >= 0) {
        return 1;
      }
      return a.localeCompare(b);
    });

    for (const region of regions) {
      const option = document.createElement("option");
      option.value = region;
      option.textContent = region;
      this.regionSelect.append(option);
    }
    this.regionSelect.value = this.selectedRegion;
  }

  private rebuildPackOptions(preferredPackId?: string): string | null {
    const filteredPacks = this.getPacksForRegion(this.selectedRegion);
    this.packSelect.innerHTML = "";
    for (const pack of filteredPacks) {
      const option = document.createElement("option");
      option.value = pack.id;
      option.textContent = pack.name;
      this.packSelect.append(option);
    }

    if (filteredPacks.length === 0) {
      return null;
    }

    const nextPackId = filteredPacks.some((pack) => pack.id === preferredPackId)
      ? (preferredPackId as string)
      : filteredPacks[0].id;
    this.packSelect.value = nextPackId;
    return nextPackId;
  }

  private getPacksForRegion(region: string): Pack[] {
    if (region === ALL_REGIONS_VALUE) {
      return this.packs;
    }
    return this.packs.filter((pack) => this.resolvePackGroup(pack) === region);
  }

  private resolvePackGroup(pack: Pack): string {
    if (pack.group && pack.group.trim().length > 0) {
      return pack.group.trim();
    }
    if (pack.id.startsWith("world_")) {
      return "World";
    }
    if (pack.id.startsWith("us_") || pack.id.startsWith("usa_")) {
      return "US";
    }
    if (pack.id.startsWith("canada_")) {
      return "Canada";
    }
    if (pack.id.startsWith("india_")) {
      return "India";
    }
    if (pack.id.startsWith("europe_")) {
      return "Europe";
    }
    if (pack.id.startsWith("africa_")) {
      return "Africa";
    }
    return "Other";
  }
}

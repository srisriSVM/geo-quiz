import { loadPackEntities, loadPacks } from "../data/dataLoader";
import type { Entity, Pack } from "../data/types";
import { normalizeText } from "../utils/normalize";
import { MapView } from "../map/MapView";
import { Hud } from "../ui/Hud";
import { QuizPanel } from "../ui/QuizPanel";
import type { QuizType } from "../quiz/quizTypes";
import {
  clearProgress,
  loadProgress,
  saveProgress,
  type ProgressItem
} from "../storage/progressStore";

type Mode = "learn" | "quiz";
type MapDetail = "quiz_clean" | "reference_full" | "physical_basic" | "physical_relief";
type MasteryState = "not_learned" | "learning" | "mastered";
type ChoiceStatus = "default" | "locked" | "wrong";

const MAP_DETAIL_KEY = "geo-bee-map-detail";
const LOW_DATA_MODE_KEY = "geo-bee-low-data-mode";

export class App {
  private readonly host: HTMLElement;

  private mapView: MapView | null = null;
  private hud: Hud | null = null;
  private panel: QuizPanel | null = null;

  private packs: Pack[] = [];
  private entitiesByPack: Record<string, Entity[]> = {};
  private activePackEntities: Entity[] = [];
  private progress: Record<string, ProgressItem> = {};

  private mode: Mode = "learn";
  private quizType: QuizType = "match_round_5";
  private mapDetail: MapDetail = "quiz_clean";
  private lowDataMode = true;
  private currentPackId = "";
  private currentEntity: Entity | null = null;
  private hintLength = 2;

  private score = 0;
  private streak = 0;
  private attempted = 0;
  private matchRound:
    | {
        choiceIds: string[];
        remainingIds: string[];
        choiceStatus: Record<string, ChoiceStatus>;
      }
    | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
  }

  async mount(): Promise<void> {
    const app = document.createElement("div");
    app.className = "app";

    const mapRoot = document.createElement("div");
    mapRoot.className = "map-root";

    const loadingPanel = document.createElement("section");
    loadingPanel.className = "quiz-panel";
    loadingPanel.textContent = "Loading app data...";

    app.append(mapRoot, loadingPanel);
    this.host.append(app);

    this.mapView = new MapView(mapRoot);
    this.mapView.mount();
    this.mapView.setEntityClickHandler((entityId) => {
      this.handleLearnEntityClick(entityId);
    });
    this.progress = loadProgress();

    try {
      const packs = await loadPacks();
      this.packs = packs;
    } catch (error) {
      loadingPanel.textContent = `Failed to load data: ${String(error)}`;
      return;
    }

    loadingPanel.remove();

    this.hud = new Hud(this.packs, {
      onModeChange: (mode) => {
        this.mode = mode;
        void this.startRound();
      },
      onPackChange: (packId) => {
        this.currentPackId = packId;
        void this.startRound();
      },
      onQuizTypeChange: (quizType) => {
        this.quizType = quizType;
        this.matchRound = null;
        void this.startRound();
      },
      onMapDetailChange: (mapDetail) => {
        this.mapDetail = mapDetail;
        localStorage.setItem(MAP_DETAIL_KEY, mapDetail);
        this.mapView?.setMapDetail(mapDetail);
      },
      onLowDataModeChange: (enabled) => {
        this.lowDataMode = enabled;
        localStorage.setItem(LOW_DATA_MODE_KEY, enabled ? "1" : "0");
        this.mapView?.setLowDataMode(enabled);
      },
      onResetProgress: () => {
        this.handleResetProgress();
      },
      onHint: () => this.handleHint(),
      onReveal: () => this.handleReveal(),
      onNext: () => void this.startRound()
    });

    this.panel = new QuizPanel({
      onSubmit: (answer) => this.handleSubmit(answer),
      onKnowIt: () => this.handleLearnAction(true),
      onNeedPractice: () => this.handleLearnAction(false),
      onSelectChoice: (choiceId) => this.handleChoiceSelection(choiceId)
    });

    app.append(this.hud.root, this.panel.root);

    const firstPack = this.packs[0];
    if (!firstPack) {
      this.panel.setPrompt("No packs available.");
      this.panel.setAnswerEnabled(false);
      return;
    }

    this.currentPackId = firstPack.id;
    this.mapDetail = this.loadMapDetail();
    this.lowDataMode = this.loadLowDataMode();
    this.hud.setMode(this.mode);
    this.hud.setPack(this.currentPackId);
    this.hud.setQuizType(this.quizType);
    this.hud.setMapDetail(this.mapDetail);
    this.hud.setLowDataMode(this.lowDataMode);
    this.mapView.setLowDataMode(this.lowDataMode);
    this.mapView.setMapDetail(this.mapDetail);

    await this.startRound();
  }

  private async startRound(excludeEntityId?: string): Promise<void> {
    if (!this.mapView || !this.hud || !this.panel) {
      return;
    }

    const pack = this.packs.find((item) => item.id === this.currentPackId);
    if (!pack) {
      return;
    }

    try {
      await this.ensurePackEntitiesLoaded(pack.id);
    } catch (error) {
      this.currentEntity = null;
      this.mapView.setHighlightedEntity(null);
      this.panel.setHeading("Geo Bee Trainer");
      this.panel.setPrompt("Failed to load this pack.");
      this.panel.setFeedback(String(error));
      this.panel.setAnswerVisible(false);
      this.panel.setAnswerEnabled(false);
      return;
    }

    const items = this.activePackEntities;
    this.mapView.setMode(this.mode);
    this.mapView.setEntities(items);
    this.mapView.setMasteryById(this.buildMasteryMap(items));
    this.mapView.flyToPack(pack);

    if (items.length === 0) {
      this.currentEntity = null;
      this.mapView.setHighlightedEntity(null);
      this.panel.setHeading("Geo Bee Trainer");
      this.panel.setPrompt("This pack has no entities.");
      this.panel.setFeedback("Add data to continue.");
      this.panel.setAnswerVisible(false);
      this.panel.setLearnActionsVisible(false);
      this.panel.setAnswerEnabled(false);
      this.hud.setStats({ score: this.score, streak: this.streak, progress: `${this.attempted} / 0` });
      return;
    }

    if (this.mode === "learn") {
      this.matchRound = null;
      this.currentEntity = this.pickRandom(items, excludeEntityId);
      this.hintLength = 2;
      this.mapView.setHighlightedEntity(this.currentEntity.id);
      this.panel.setHeading("Learn Mode");
      this.panel.setPrompt(
        `Study this highlighted ${this.currentEntity.type}: ${this.currentEntity.name}. Click Next for another one, or switch Mode to Quiz.`
      );
      this.panel.setFeedback(`You are in Learn mode. No answer is required.`);
      this.panel.setAnswerVisible(false);
      this.panel.setLearnActionsVisible(true);
      this.panel.setChoicesVisible(false);
      this.panel.setChoices([]);
      this.panel.setAnswerEnabled(false);
    } else {
      this.panel.setHeading("Quiz Mode");
      this.panel.setLearnActionsVisible(false);
      if (this.quizType === "match_round_5") {
        this.setupMatchRound(items);
      } else {
        this.matchRound = null;
        this.currentEntity = this.pickRandom(items, excludeEntityId);
        this.hintLength = 2;
        this.mapView.setHighlightedEntity(this.currentEntity.id);
        this.mapView.focusEntity(this.currentEntity);
        this.panel.setPrompt("Identify the highlighted location.");
        this.panel.setFeedback("Type the answer and submit.");
        this.panel.setAnswerVisible(true);
        this.panel.setChoicesVisible(false);
        this.panel.setChoices([]);
        this.panel.setAnswerEnabled(true);
        this.panel.focusAnswer();
      }
    }

    const masteredCount = items.filter((entity) => this.getMastery(entity.id) === "mastered").length;
    this.hud.setStats({
      score: this.score,
      streak: this.streak,
      progress: this.mode === "learn" ? `Mastered ${masteredCount} / ${items.length}` : `${this.attempted} / ${items.length}`
    });
  }

  private handleSubmit(answer: string): void {
    if (!this.panel || this.mode !== "quiz" || !this.currentEntity) {
      return;
    }

    this.attempted += 1;

    const gotIt = normalizeText(answer) === normalizeText(this.currentEntity.name);
    if (gotIt) {
      this.score += 1;
      this.streak += 1;
      this.panel.setFeedback(`Correct. It is ${this.currentEntity.name}.`);
    } else {
      this.streak = 0;
      this.panel.setFeedback(`Not correct. The answer is ${this.currentEntity.name}.`);
    }
    this.recordProgress(this.currentEntity.id, gotIt);
    this.mapView?.setMasteryById(this.buildMasteryMap(this.activePackEntities));

    const packSize = this.activePackEntities.length;
    this.hud?.setStats({
      score: this.score,
      streak: this.streak,
      progress: `${this.attempted} / ${packSize}`
    });
  }

  private handleChoiceSelection(choiceId: string): void {
    if (this.mode !== "quiz" || this.quizType !== "match_round_5" || !this.matchRound || !this.currentEntity) {
      return;
    }

    if (this.matchRound.choiceStatus[choiceId] === "locked") {
      return;
    }

    if (choiceId === this.currentEntity.id) {
      this.markMasteredFromLearn(choiceId);
      this.score += 1;
      this.streak += 1;
      this.attempted += 1;
      this.matchRound.choiceStatus[choiceId] = "locked";
      this.matchRound.remainingIds = this.matchRound.remainingIds.filter((id) => id !== choiceId);
      this.mapView?.setMasteryById(this.buildMasteryMap(this.activePackEntities));
      const remainingCount = this.matchRound.remainingIds.length;
      if (remainingCount === 0) {
        this.panel?.setFeedback("Round complete. Great job.");
        this.panel?.setPrompt("All matched. Click Next for a new round.");
        this.panel?.setChoices(this.buildChoicesFromRound());
        this.panel?.animateChoice(choiceId, "success");
        this.mapView?.setHighlightedEntity(null);
      } else {
        this.currentEntity = this.pickRandom(this.getRemainingRoundEntities());
        this.mapView?.setHighlightedEntity(this.currentEntity.id);
        this.mapView?.focusEntity(this.currentEntity);
        this.panel?.setPrompt(`Match the highlighted ${this.currentEntity.type}. Remaining: ${remainingCount}`);
        this.panel?.setFeedback("Correct. Keep going.");
        this.panel?.setChoices(this.buildChoicesFromRound());
        this.panel?.animateChoice(choiceId, "success");
      }
    } else {
      this.recordProgress(this.currentEntity.id, false);
      this.streak = 0;
      this.attempted += 1;
      this.matchRound.choiceStatus[choiceId] = "wrong";
      this.panel?.setFeedback("Not this one. Try again.");
      this.panel?.setChoices(this.buildChoicesFromRound());
      this.panel?.animateChoice(choiceId, "wrong");
    }

    this.hud?.setStats({
      score: this.score,
      streak: this.streak,
      progress: `${this.attempted} / ${this.activePackEntities.length}`
    });
  }

  private handleLearnAction(knewIt: boolean): void {
    if (!this.currentEntity || this.mode !== "learn") {
      return;
    }

    const priorId = this.currentEntity.id;
    if (knewIt) {
      this.markMasteredFromLearn(priorId);
    } else {
      this.recordProgress(priorId, false);
    }
    const mastery = this.getMastery(priorId);
    this.panel?.setFeedback(
      knewIt
        ? `Nice. Marked as known (${mastery.replace("_", " ")}).`
        : "Marked for practice. We will show this again soon."
    );
    void this.startRound(priorId);
  }

  private handleLearnEntityClick(entityId: string): void {
    if (this.mode !== "learn" || !this.mapView || !this.panel || !this.hud) {
      return;
    }

    const selected = this.activePackEntities.find((entity) => entity.id === entityId);
    if (!selected) {
      return;
    }

    this.currentEntity = selected;
    this.hintLength = 2;
    this.mapView.setHighlightedEntity(selected.id);
    this.panel.setHeading("Learn Mode");
    this.panel.setPrompt(
      `Study this highlighted ${selected.type}: ${selected.name}. Click Next for another one, or switch Mode to Quiz.`
    );
    this.panel.setFeedback(`Selected: ${selected.name}`);
  }

  private handleHint(): void {
    if (!this.panel || !this.currentEntity || this.mode !== "quiz") {
      return;
    }

    const hint = this.currentEntity.name.slice(0, this.hintLength);
    this.hintLength = Math.min(this.currentEntity.name.length, this.hintLength + 1);
    this.panel.setFeedback(`Hint: starts with "${hint}"`);
  }

  private handleReveal(): void {
    if (!this.panel || !this.currentEntity) {
      return;
    }

    this.streak = 0;
    this.panel.setFeedback(`Revealed: ${this.currentEntity.name}`);
    this.hud?.setStats({
      score: this.score,
      streak: this.streak,
      progress: `${this.attempted} / ${this.activePackEntities.length}`
    });
  }

  private pickRandom(items: Entity[], excludeEntityId?: string): Entity {
    const eligible = excludeEntityId ? items.filter((item) => item.id !== excludeEntityId) : items;
    const basePool = eligible.length > 0 ? eligible : items;
    const weighted: Entity[] = [];
    for (const item of basePool) {
      const mastery = this.getMastery(item.id);
      const repeats = mastery === "not_learned" ? 4 : mastery === "learning" ? 2 : 1;
      for (let i = 0; i < repeats; i += 1) {
        weighted.push(item);
      }
    }
    const pool = weighted.length > 0 ? weighted : basePool;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  private setupMatchRound(items: Entity[]): void {
    const nonMastered = items.filter((item) => this.getMastery(item.id) !== "mastered");
    const sourcePool = nonMastered.length > 0 ? nonMastered : items;
    const roundSize = Math.min(5, sourcePool.length);
    const shuffled = sourcePool.slice().sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, roundSize);
    const choiceIds = selected.map((item) => item.id);
    this.matchRound = {
      choiceIds,
      remainingIds: choiceIds.slice(),
      choiceStatus: Object.fromEntries(choiceIds.map((id) => [id, "default"])) as Record<string, ChoiceStatus>
    };

    this.currentEntity = this.pickRandom(selected);
    this.mapView?.setHighlightedEntity(this.currentEntity.id);
    this.mapView?.focusEntity(this.currentEntity);
    this.panel?.setAnswerVisible(false);
    this.panel?.setAnswerEnabled(false);
    this.panel?.setChoicesVisible(true);
    this.panel?.setChoices(this.buildChoicesFromRound());
    this.panel?.setPrompt(`Match the highlighted ${this.currentEntity.type}. Remaining: ${roundSize}`);
    this.panel?.setFeedback(
      nonMastered.length > 0
        ? "Select the correct name card."
        : "All items are mastered. Great job. You can still play review rounds."
    );
  }

  private buildChoicesFromRound(): Array<{ id: string; label: string; status: ChoiceStatus }> {
    if (!this.matchRound) {
      return [];
    }

    return this.matchRound.choiceIds.map((id) => {
      const entity = this.activePackEntities.find((item) => item.id === id);
      return {
        id,
        label: entity?.name ?? id,
        status: this.matchRound?.choiceStatus[id] ?? "default"
      };
    });
  }

  private getRemainingRoundEntities(): Entity[] {
    if (!this.matchRound) {
      return [];
    }
    return this.activePackEntities.filter((entity) => this.matchRound?.remainingIds.includes(entity.id));
  }

  private loadMapDetail(): MapDetail {
    const raw = localStorage.getItem(MAP_DETAIL_KEY);
    if (
      raw === "quiz_clean" ||
      raw === "reference_full" ||
      raw === "physical_basic" ||
      raw === "physical_relief"
    ) {
      return raw;
    }
    return "quiz_clean";
  }

  private loadLowDataMode(): boolean {
    const raw = localStorage.getItem(LOW_DATA_MODE_KEY);
    if (raw === "0") {
      return false;
    }
    return true;
  }

  private handleResetProgress(): void {
    this.progress = {};
    clearProgress();
    this.score = 0;
    this.streak = 0;
    this.attempted = 0;
    this.matchRound = null;
    this.mapView?.setMasteryById(this.buildMasteryMap(this.activePackEntities));
    this.panel?.setFeedback("Progress reset. Everything is back to not learned.");
    void this.startRound();
  }

  private async ensurePackEntitiesLoaded(packId: string): Promise<void> {
    if (!this.entitiesByPack[packId]) {
      this.entitiesByPack[packId] = await loadPackEntities(packId);
    }
    this.activePackEntities = this.entitiesByPack[packId];
  }

  private recordProgress(entityId: string, wasCorrect: boolean): void {
    const prev = this.progress[entityId] ?? {
      seenCount: 0,
      correctCount: 0,
      streak: 0,
      lastSeen: null,
      lastResult: null
    };

    const next: ProgressItem = {
      seenCount: prev.seenCount + 1,
      correctCount: prev.correctCount + (wasCorrect ? 1 : 0),
      streak: wasCorrect ? prev.streak + 1 : 0,
      lastSeen: Date.now(),
      lastResult: wasCorrect
    };
    this.progress[entityId] = next;
    saveProgress(this.progress);
  }

  private markMasteredFromLearn(entityId: string): void {
    const prev = this.progress[entityId] ?? {
      seenCount: 0,
      correctCount: 0,
      streak: 0,
      lastSeen: null,
      lastResult: null
    };

    const seenCount = Math.max(prev.seenCount + 1, 5);
    const correctCount = Math.max(prev.correctCount + 1, Math.ceil(seenCount * 0.8));
    const streak = Math.max(prev.streak + 1, 2);

    this.progress[entityId] = {
      seenCount,
      correctCount,
      streak,
      lastSeen: Date.now(),
      lastResult: true
    };
    saveProgress(this.progress);
  }

  private getMastery(entityId: string): MasteryState {
    const item = this.progress[entityId];
    if (!item || item.seenCount < 2) {
      return "not_learned";
    }

    const accuracy = item.correctCount / Math.max(item.seenCount, 1);
    if (item.seenCount >= 5 && accuracy >= 0.8 && item.streak >= 2) {
      return "mastered";
    }
    return "learning";
  }

  private buildMasteryMap(items: Entity[]): Record<string, MasteryState> {
    const out: Record<string, MasteryState> = {};
    for (const item of items) {
      out[item.id] = this.getMastery(item.id);
    }
    return out;
  }
}

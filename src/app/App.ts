import { loadPackEntities, loadPacks } from "../data/dataLoader";
import type { Entity, Pack } from "../data/types";
import { normalizeText } from "../utils/normalize";
import { MapView } from "../map/MapView";
import { Hud } from "../ui/Hud";
import { QuizPanel } from "../ui/QuizPanel";

type Mode = "learn" | "quiz";
type MapDetail = "quiz_clean" | "reference_full" | "physical_basic" | "physical_relief";

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

  private mode: Mode = "learn";
  private mapDetail: MapDetail = "quiz_clean";
  private lowDataMode = true;
  private currentPackId = "";
  private currentEntity: Entity | null = null;
  private hintLength = 2;

  private score = 0;
  private streak = 0;
  private attempted = 0;

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
      onQuizTypeChange: () => {
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
      onHint: () => this.handleHint(),
      onReveal: () => this.handleReveal(),
      onNext: () => void this.startRound()
    });

    this.panel = new QuizPanel({
      onSubmit: (answer) => this.handleSubmit(answer)
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
    this.hud.setMapDetail(this.mapDetail);
    this.hud.setLowDataMode(this.lowDataMode);
    this.mapView.setLowDataMode(this.lowDataMode);
    this.mapView.setMapDetail(this.mapDetail);

    await this.startRound();
  }

  private async startRound(): Promise<void> {
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
    this.mapView.flyToPack(pack);

    if (items.length === 0) {
      this.currentEntity = null;
      this.mapView.setHighlightedEntity(null);
      this.panel.setHeading("Geo Bee Trainer");
      this.panel.setPrompt("This pack has no entities.");
      this.panel.setFeedback("Add data to continue.");
      this.panel.setAnswerVisible(false);
      this.panel.setAnswerEnabled(false);
      this.hud.setStats({ score: this.score, streak: this.streak, progress: `${this.attempted} / 0` });
      return;
    }

    this.currentEntity = this.pickRandom(items);
    this.hintLength = 2;

    this.mapView.setHighlightedEntity(this.currentEntity.id);
    if (this.mode === "quiz") {
      this.mapView.focusEntity(this.currentEntity);
    }
    this.panel.setAnswer("");

    if (this.mode === "learn") {
      this.panel.setHeading("Learn Mode");
      this.panel.setPrompt(
        `Study this highlighted ${this.currentEntity.type}: ${this.currentEntity.name}. Click Next for another one, or switch Mode to Quiz.`
      );
      this.panel.setFeedback(`You are in Learn mode. No answer is required.`);
      this.panel.setAnswerVisible(false);
      this.panel.setAnswerEnabled(false);
    } else {
      this.panel.setHeading("Quiz Mode");
      this.panel.setPrompt("Identify the highlighted location.");
      this.panel.setFeedback("Type the answer and submit.");
      this.panel.setAnswerVisible(true);
      this.panel.setAnswerEnabled(true);
      this.panel.focusAnswer();
    }

    this.hud.setStats({
      score: this.score,
      streak: this.streak,
      progress: `${this.attempted} / ${items.length}`
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

    const packSize = this.activePackEntities.length;
    this.hud?.setStats({
      score: this.score,
      streak: this.streak,
      progress: `${this.attempted} / ${packSize}`
    });
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

  private pickRandom(items: Entity[]): Entity {
    const index = Math.floor(Math.random() * items.length);
    return items[index];
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

  private async ensurePackEntitiesLoaded(packId: string): Promise<void> {
    if (!this.entitiesByPack[packId]) {
      this.entitiesByPack[packId] = await loadPackEntities(packId);
    }
    this.activePackEntities = this.entitiesByPack[packId];
  }
}

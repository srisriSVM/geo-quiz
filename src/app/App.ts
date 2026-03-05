import { loadEntities, loadPacks } from "../data/dataLoader";
import type { Entity, Pack } from "../data/types";
import { normalizeText } from "../utils/normalize";
import { MapView } from "../map/MapView";
import { Hud } from "../ui/Hud";
import { QuizPanel } from "../ui/QuizPanel";

type Mode = "learn" | "quiz";

export class App {
  private readonly host: HTMLElement;

  private mapView: MapView | null = null;
  private hud: Hud | null = null;
  private panel: QuizPanel | null = null;

  private packs: Pack[] = [];
  private entities: Entity[] = [];

  private mode: Mode = "learn";
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
      const [packs, entities] = await Promise.all([loadPacks(), loadEntities()]);
      this.packs = packs;
      this.entities = entities;
    } catch (error) {
      loadingPanel.textContent = `Failed to load data: ${String(error)}`;
      return;
    }

    loadingPanel.remove();

    this.hud = new Hud(this.packs, {
      onModeChange: (mode) => {
        this.mode = mode;
        this.startRound();
      },
      onPackChange: (packId) => {
        this.currentPackId = packId;
        this.startRound();
      },
      onQuizTypeChange: () => {
        this.startRound();
      },
      onHint: () => this.handleHint(),
      onReveal: () => this.handleReveal(),
      onNext: () => this.startRound()
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
    this.hud.setMode(this.mode);
    this.hud.setPack(this.currentPackId);

    this.startRound();
  }

  private startRound(): void {
    if (!this.mapView || !this.hud || !this.panel) {
      return;
    }

    const pack = this.packs.find((item) => item.id === this.currentPackId);
    if (!pack) {
      return;
    }

    const items = this.entities.filter((entity) => entity.packIds.includes(pack.id));
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
        `Study this highlighted country: ${this.currentEntity.name}. Click Next for another one, or switch Mode to Quiz.`
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

    const packSize = this.entities.filter((entity) => entity.packIds.includes(this.currentPackId)).length;
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
      progress: `${this.attempted} / ${this.entities.filter((entity) => entity.packIds.includes(this.currentPackId)).length}`
    });
  }

  private pickRandom(items: Entity[]): Entity {
    const index = Math.floor(Math.random() * items.length);
    return items[index];
  }
}

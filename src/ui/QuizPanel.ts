import type { Entity } from "../data/types";

type QuizPanelActions = {
  onSubmit: (answer: string) => void;
  onKnowIt: () => void;
  onNeedPractice: () => void;
  onSelectChoice: (choiceId: string) => void;
};

type ChoiceItem = {
  id: string;
  label: string;
  status?: "default" | "locked" | "wrong";
};

export class QuizPanel {
  readonly root: HTMLElement;

  private readonly headingEl: HTMLElement;
  private readonly promptEl: HTMLElement;
  private readonly answerGroupEl: HTMLElement;
  private readonly answerInput: HTMLInputElement;
  private readonly feedbackEl: HTMLElement;
  private readonly learnTitleEl: HTMLElement;
  private readonly submitButton: HTMLButtonElement;
  private readonly learnActionsEl: HTMLElement;
  private readonly knowItButton: HTMLButtonElement;
  private readonly needPracticeButton: HTMLButtonElement;
  private readonly choicesEl: HTMLElement;
  private readonly learnInfoEl: HTMLElement;
  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  constructor(actions: QuizPanelActions) {
    this.root = document.createElement("section");
    this.root.className = "quiz-panel";

    this.root.innerHTML = `
      <h2 data-role="heading">Geo Bee Trainer</h2>
      <p data-role="prompt"><strong>Prompt:</strong> Loading data...</p>
      <p data-role="learn-title" class="learn-target-title" style="display:none;"></p>
      <label data-role="answer-group">
        Your answer
        <input data-role="answer" type="text" placeholder="Type here" style="width: 100%; margin-top: 8px; padding: 10px;" />
      </label>
      <button data-role="submit" type="button" style="margin-top: 10px; padding: 10px 12px;">Submit</button>
      <div data-role="choices" style="display:none; margin-top:10px; gap:8px; flex-wrap:wrap;"></div>
      <div data-role="learn-actions" class="learn-actions-row" style="display: none;">
        <button data-role="know-it" type="button" class="learn-know-btn">✓ I know this</button>
        <button data-role="need-practice" type="button" class="learn-practice-btn">Need practice</button>
      </div>
      <section data-role="learn-info" class="learn-info" style="display:none;"></section>
      <p data-role="feedback" style="margin-bottom: 0;"><strong>Feedback:</strong> Waiting for your answer.</p>
    `;

    this.headingEl = this.query<HTMLElement>("[data-role='heading']");
    this.promptEl = this.query<HTMLElement>("[data-role='prompt']");
    this.answerGroupEl = this.query<HTMLElement>("[data-role='answer-group']");
    this.answerInput = this.query<HTMLInputElement>("[data-role='answer']");
    this.feedbackEl = this.query<HTMLElement>("[data-role='feedback']");
    this.learnTitleEl = this.query<HTMLElement>("[data-role='learn-title']");
    this.submitButton = this.query<HTMLButtonElement>("[data-role='submit']");
    this.learnActionsEl = this.query<HTMLElement>("[data-role='learn-actions']");
    this.knowItButton = this.query<HTMLButtonElement>("[data-role='know-it']");
    this.needPracticeButton = this.query<HTMLButtonElement>("[data-role='need-practice']");
    this.choicesEl = this.query<HTMLElement>("[data-role='choices']");
    this.learnInfoEl = this.query<HTMLElement>("[data-role='learn-info']");
    this.headingEl.classList.add("quiz-panel-drag-handle");

    const submit = (): void => {
      actions.onSubmit(this.answerInput.value);
    };

    this.submitButton.addEventListener("click", submit);
    this.answerInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        submit();
      }
    });

    this.knowItButton.addEventListener("click", actions.onKnowIt);
    this.needPracticeButton.addEventListener("click", actions.onNeedPractice);
    this.choicesEl.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>("[data-choice-id]");
      if (!button || button.disabled) {
        return;
      }
      const choiceId = button.dataset.choiceId;
      if (choiceId) {
        actions.onSelectChoice(choiceId);
      }
    });

    this.headingEl.addEventListener("pointerdown", (event) => {
      const rect = this.root.getBoundingClientRect();
      this.dragging = true;
      this.dragOffsetX = event.clientX - rect.left;
      this.dragOffsetY = event.clientY - rect.top;
      this.headingEl.setPointerCapture(event.pointerId);
      this.headingEl.classList.add("quiz-panel-dragging");
      this.root.style.right = "auto";
      this.root.style.bottom = "auto";
      this.movePanel(event.clientX, event.clientY);
    });

    this.headingEl.addEventListener("pointermove", (event) => {
      if (!this.dragging) {
        return;
      }
      this.movePanel(event.clientX, event.clientY);
    });

    const stopDrag = (pointerId?: number): void => {
      if (!this.dragging) {
        return;
      }
      this.dragging = false;
      this.headingEl.classList.remove("quiz-panel-dragging");
      if (typeof pointerId === "number" && this.headingEl.hasPointerCapture(pointerId)) {
        this.headingEl.releasePointerCapture(pointerId);
      }
    };

    this.headingEl.addEventListener("pointerup", (event) => {
      stopDrag(event.pointerId);
    });
    this.headingEl.addEventListener("pointercancel", (event) => {
      stopDrag(event.pointerId);
    });
  }

  setHeading(value: string): void {
    this.headingEl.textContent = value;
  }

  setHeadingVisible(visible: boolean): void {
    this.headingEl.style.display = visible ? "block" : "none";
  }

  setPrompt(value: string): void {
    this.promptEl.innerHTML = `<strong>Prompt:</strong> ${value}`;
  }

  setPromptVisible(visible: boolean): void {
    this.promptEl.style.display = visible ? "block" : "none";
  }

  setFeedback(value: string): void {
    this.feedbackEl.innerHTML = `<strong>Feedback:</strong> ${value}`;
  }

  setFeedbackVisible(visible: boolean): void {
    this.feedbackEl.style.display = visible ? "block" : "none";
  }

  setLearnTargetTitle(value: string | null): void {
    if (!value) {
      this.learnTitleEl.style.display = "none";
      this.learnTitleEl.textContent = "";
      return;
    }
    this.learnTitleEl.textContent = value;
    this.learnTitleEl.style.display = "block";
  }

  setAnswer(value: string): void {
    this.answerInput.value = value;
  }

  focusAnswer(): void {
    this.answerInput.focus();
  }

  setAnswerEnabled(enabled: boolean): void {
    this.answerInput.disabled = !enabled;
    this.submitButton.disabled = !enabled;
  }

  setAnswerVisible(visible: boolean): void {
    this.answerGroupEl.style.display = visible ? "block" : "none";
    this.submitButton.style.display = visible ? "inline-block" : "none";
  }

  setLearnActionsVisible(visible: boolean): void {
    this.learnActionsEl.style.display = visible ? "flex" : "none";
    if (!visible) {
      this.learnInfoEl.style.display = "none";
    }
  }

  setChoicesVisible(visible: boolean): void {
    this.choicesEl.style.display = visible ? "flex" : "none";
  }

  setChoices(choices: ChoiceItem[]): void {
    this.choicesEl.innerHTML = "";
    for (const [index, choice] of choices.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.choiceId = choice.id;
      button.textContent = choice.label;
      button.className = "choice-chip";
      button.style.animationDelay = `${index * 40}ms`;
      if (choice.status === "locked") {
        button.classList.add("choice-chip--locked");
        button.disabled = true;
      } else if (choice.status === "wrong") {
        button.classList.add("choice-chip--wrong");
      }
      this.choicesEl.append(button);
    }
  }

  animateChoice(choiceId: string, kind: "success" | "wrong"): void {
    const button = this.choicesEl.querySelector<HTMLButtonElement>(`[data-choice-id="${choiceId}"]`);
    if (!button) {
      return;
    }
    const className = kind === "success" ? "choice-chip--pop" : "choice-chip--shake";
    button.classList.remove(className);
    // Force reflow so repeated clicks replay the animation.
    void button.offsetWidth;
    button.classList.add(className);
  }

  setLearnEntityInfo(entity: Entity | null): void {
    if (!entity) {
      this.learnInfoEl.style.display = "none";
      this.learnInfoEl.innerHTML = "";
      return;
    }

    const factCards = (entity.factCards ?? []).slice(0, 4);
    const narrativeFacts = (entity.facts ?? []).slice(0, 2);
    const chips: string[] = [];
    if (entity.difficulty) {
      chips.push(`<span class="learn-chip learn-chip--${entity.difficulty}">Difficulty: ${entity.difficulty}</span>`);
    }
    if (entity.ageBand) {
      chips.push(`<span class="learn-chip">Age: ${entity.ageBand}</span>`);
    }
    if (entity.pronunciation) {
      chips.push(`<span class="learn-chip">Say: ${entity.pronunciation}</span>`);
    }

    const lines: string[] = [];
    if (entity.learningObjective) {
      lines.push(`<p><strong>Focus:</strong> ${entity.learningObjective}</p>`);
    }
    for (const fact of narrativeFacts) {
      lines.push(`<p><strong>Fact:</strong> ${fact}</p>`);
    }
    if (entity.didYouKnow) {
      lines.push(`<p><strong>Did you know?</strong> ${entity.didYouKnow}</p>`);
    }
    if (entity.mnemonic) {
      lines.push(`<p><strong>Memory tip:</strong> ${entity.mnemonic}</p>`);
    }

    const chipRow = chips.length > 0 ? `<div class="learn-chip-row">${chips.join("")}</div>` : "";
    const hasContent = chips.length > 0 || factCards.length > 0 || lines.length > 0;
    if (!hasContent) {
      this.learnInfoEl.style.display = "none";
      this.learnInfoEl.innerHTML = "";
      return;
    }
    const cardRow =
      factCards.length > 0
        ? `<div class="fact-card-grid">${factCards
            .map(
              (card) => `<article class="fact-card">
                <header class="fact-card-title">${this.iconFor(card.icon)} ${card.title}</header>
                <p class="fact-card-value">${card.value}</p>
              </article>`
            )
            .join("")}</div>`
        : "";
    this.learnInfoEl.innerHTML = `<h3 class="learn-info-title">Learn Info</h3>${chipRow}${cardRow}${lines.join("")}`;
    this.learnInfoEl.style.display = "block";
  }

  private query<T extends HTMLElement>(selector: string): T {
    const el = this.root.querySelector<T>(selector);
    if (!el) {
      throw new Error(`Missing quiz panel element ${selector}`);
    }

    return el;
  }

  private movePanel(clientX: number, clientY: number): void {
    const panelRect = this.root.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - panelRect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - panelRect.height - 8);
    const left = Math.min(Math.max(8, clientX - this.dragOffsetX), maxLeft);
    const top = Math.min(Math.max(8, clientY - this.dragOffsetY), maxTop);
    this.root.style.left = `${left}px`;
    this.root.style.top = `${top}px`;
  }

  private iconFor(icon?: string): string {
    switch (icon) {
      case "city":
        return "🏙️";
      case "globe":
        return "🌍";
      case "mountain":
        return "⛰️";
      case "river":
        return "🌊";
      case "people":
        return "👥";
      case "calendar":
        return "📅";
      default:
        return "✨";
    }
  }
}

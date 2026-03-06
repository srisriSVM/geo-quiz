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

  private readonly dragStripEl: HTMLElement;
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
  private mediaRenderToken = 0;
  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  constructor(actions: QuizPanelActions) {
    this.root = document.createElement("section");
    this.root.className = "quiz-panel";

    this.root.innerHTML = `
      <div data-role="drag-strip" class="quiz-panel-drag-strip" aria-label="Move panel"></div>
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

    this.dragStripEl = this.query<HTMLElement>("[data-role='drag-strip']");
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

    this.dragStripEl.addEventListener("pointerdown", (event) => {
      const rect = this.root.getBoundingClientRect();
      this.dragging = true;
      this.dragOffsetX = event.clientX - rect.left;
      this.dragOffsetY = event.clientY - rect.top;
      this.dragStripEl.setPointerCapture(event.pointerId);
      this.root.classList.add("quiz-panel-dragging");
      this.root.style.right = "auto";
      this.root.style.bottom = "auto";
      this.movePanel(event.clientX, event.clientY);
    });

    this.dragStripEl.addEventListener("pointermove", (event) => {
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
      this.root.classList.remove("quiz-panel-dragging");
      if (typeof pointerId === "number" && this.dragStripEl.hasPointerCapture(pointerId)) {
        this.dragStripEl.releasePointerCapture(pointerId);
      }
    };

    this.dragStripEl.addEventListener("pointerup", (event) => {
      stopDrag(event.pointerId);
    });
    this.dragStripEl.addEventListener("pointercancel", (event) => {
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
      this.mediaRenderToken += 1;
      this.learnInfoEl.style.display = "none";
      this.learnInfoEl.innerHTML = "";
      return;
    }
    this.mediaRenderToken += 1;
    const mediaToken = this.mediaRenderToken;

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
    if (entity.type === "capital" && entity.adminOf) {
      lines.push(`<p><strong>Belongs to:</strong> ${entity.adminOf.name} (${entity.adminOf.type})</p>`);
    }
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

    const mediaItems = this.resolveMediaItems(entity);
    const mediaCard =
      mediaItems.length > 0
        ? `<figure class="learn-media-card" data-role="learn-media-card">
            <img
              data-role="learn-media-image"
              alt=""
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
            />
            ${
              mediaItems.length > 1
                ? `<button type="button" data-role="media-prev" class="learn-media-nav learn-media-nav--prev" aria-label="Previous image">‹</button>
                   <button type="button" data-role="media-next" class="learn-media-nav learn-media-nav--next" aria-label="Next image">›</button>
                   <span data-role="media-count" class="learn-media-count"></span>`
                : ""
            }
            <figcaption data-role="learn-media-caption"></figcaption>
          </figure>`
        : "";

    const chipRow = chips.length > 0 ? `<div class="learn-chip-row">${chips.join("")}</div>` : "";
    const hasContent = chips.length > 0 || factCards.length > 0 || lines.length > 0 || mediaCard.length > 0;
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
    this.learnInfoEl.innerHTML = `<h3 class="learn-info-title">Learn Info</h3>${chipRow}${mediaCard}${cardRow}${lines.join("")}`;
    this.learnInfoEl.style.display = "block";
    this.attachMediaHandlers(entity, mediaItems, mediaToken);
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

  private resolveMediaItems(entity: Entity): Array<{
    imageUrl: string;
    sourceUrl?: string;
    alt?: string;
    credit?: string;
  }> {
    const images = entity.media?.images ?? [];
    if (images.length > 0) {
      return images.filter((item) => Boolean(item.imageUrl));
    }
    if (entity.media?.imageUrl) {
      return [entity.media];
    }
    return [];
  }

  private attachMediaHandlers(
    entity: Entity,
    mediaItems: Array<{ imageUrl: string; sourceUrl?: string; alt?: string; credit?: string }>,
    mediaToken: number
  ): void {
    const card = this.learnInfoEl.querySelector<HTMLElement>("[data-role='learn-media-card']");
    const image = this.learnInfoEl.querySelector<HTMLImageElement>("[data-role='learn-media-image']");
    const caption = this.learnInfoEl.querySelector<HTMLElement>("[data-role='learn-media-caption']");
    if (!card || !image || !caption || mediaItems.length === 0) {
      return;
    }

    const prevButton = this.learnInfoEl.querySelector<HTMLButtonElement>("[data-role='media-prev']");
    const nextButton = this.learnInfoEl.querySelector<HTMLButtonElement>("[data-role='media-next']");
    const countEl = this.learnInfoEl.querySelector<HTMLElement>("[data-role='media-count']");
    Promise.all(mediaItems.map((item) => this.validateImageUrl(item.imageUrl))).then((results) => {
      if (mediaToken !== this.mediaRenderToken) {
        return;
      }
      const validItems = mediaItems.filter((_, idx) => results[idx]);
      if (validItems.length === 0) {
        card.classList.add("learn-media-card--hidden");
        return;
      }
      if (validItems.length <= 1) {
        prevButton?.classList.add("learn-media-nav--hidden");
        nextButton?.classList.add("learn-media-nav--hidden");
        if (countEl) {
          countEl.style.display = "none";
        }
      }

      let index = 0;
      const renderAt = (nextIndex: number): void => {
        index = (nextIndex + validItems.length) % validItems.length;
        const item = validItems[index];
        image.src = item.imageUrl;
        image.alt = item.alt ?? `${entity.name} image ${index + 1}`;
        const credit = item.credit ? `<span>${item.credit}</span>` : "";
        const source = item.sourceUrl
          ? `<a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">Source</a>`
          : "";
        caption.innerHTML = `${credit}${source}`;
        if (countEl) {
          countEl.textContent = `${index + 1}/${validItems.length}`;
        }
      };

      prevButton?.addEventListener("click", () => renderAt(index - 1));
      nextButton?.addEventListener("click", () => renderAt(index + 1));
      renderAt(0);
    });
  }

  private validateImageUrl(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const probe = new Image();
      probe.decoding = "async";
      probe.loading = "eager";
      probe.referrerPolicy = "no-referrer";
      probe.onload = () => resolve(true);
      probe.onerror = () => resolve(false);
      probe.src = url;
    });
  }
}

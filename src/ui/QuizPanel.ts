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
  private readonly submitButton: HTMLButtonElement;
  private readonly learnActionsEl: HTMLElement;
  private readonly knowItButton: HTMLButtonElement;
  private readonly needPracticeButton: HTMLButtonElement;
  private readonly choicesEl: HTMLElement;
  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  constructor(actions: QuizPanelActions) {
    this.root = document.createElement("section");
    this.root.className = "quiz-panel";

    this.root.innerHTML = `
      <h2 data-role="heading">Geo Bee Trainer</h2>
      <p data-role="prompt"><strong>Prompt:</strong> Loading data...</p>
      <label data-role="answer-group">
        Your answer
        <input data-role="answer" type="text" placeholder="Type here" style="width: 100%; margin-top: 8px; padding: 10px;" />
      </label>
      <button data-role="submit" type="button" style="margin-top: 10px; padding: 10px 12px;">Submit</button>
      <div data-role="choices" style="display:none; margin-top:10px; gap:8px; flex-wrap:wrap;"></div>
      <div data-role="learn-actions" style="display: none; margin-top: 10px; gap: 8px;">
        <button data-role="know-it" type="button" style="padding: 10px 12px;">I know this</button>
        <button data-role="need-practice" type="button" style="padding: 10px 12px;">Need practice</button>
      </div>
      <p data-role="feedback" style="margin-bottom: 0;"><strong>Feedback:</strong> Waiting for your answer.</p>
    `;

    this.headingEl = this.query<HTMLElement>("[data-role='heading']");
    this.promptEl = this.query<HTMLElement>("[data-role='prompt']");
    this.answerGroupEl = this.query<HTMLElement>("[data-role='answer-group']");
    this.answerInput = this.query<HTMLInputElement>("[data-role='answer']");
    this.feedbackEl = this.query<HTMLElement>("[data-role='feedback']");
    this.submitButton = this.query<HTMLButtonElement>("[data-role='submit']");
    this.learnActionsEl = this.query<HTMLElement>("[data-role='learn-actions']");
    this.knowItButton = this.query<HTMLButtonElement>("[data-role='know-it']");
    this.needPracticeButton = this.query<HTMLButtonElement>("[data-role='need-practice']");
    this.choicesEl = this.query<HTMLElement>("[data-role='choices']");
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

  setPrompt(value: string): void {
    this.promptEl.innerHTML = `<strong>Prompt:</strong> ${value}`;
  }

  setFeedback(value: string): void {
    this.feedbackEl.innerHTML = `<strong>Feedback:</strong> ${value}`;
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
}

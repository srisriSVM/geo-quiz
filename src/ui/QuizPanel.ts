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
    for (const choice of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.choiceId = choice.id;
      button.textContent = choice.label;
      button.style.padding = "8px 10px";
      button.style.borderRadius = "10px";
      button.style.border = "1px solid #cbd5e1";
      button.style.background = "#ffffff";
      button.style.color = "#102a43";
      button.style.cursor = "pointer";
      if (choice.status === "locked") {
        button.style.background = "#dcfce7";
        button.style.borderColor = "#16a34a";
        button.style.color = "#14532d";
        button.disabled = true;
      } else if (choice.status === "wrong") {
        button.style.background = "#fee2e2";
        button.style.borderColor = "#dc2626";
        button.style.color = "#7f1d1d";
      }
      this.choicesEl.append(button);
    }
  }

  private query<T extends HTMLElement>(selector: string): T {
    const el = this.root.querySelector<T>(selector);
    if (!el) {
      throw new Error(`Missing quiz panel element ${selector}`);
    }

    return el;
  }
}

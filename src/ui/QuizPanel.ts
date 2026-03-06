type QuizPanelActions = {
  onSubmit: (answer: string) => void;
  onKnowIt: () => void;
  onNeedPractice: () => void;
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

  private query<T extends HTMLElement>(selector: string): T {
    const el = this.root.querySelector<T>(selector);
    if (!el) {
      throw new Error(`Missing quiz panel element ${selector}`);
    }

    return el;
  }
}

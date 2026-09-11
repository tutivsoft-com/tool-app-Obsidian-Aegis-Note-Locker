import { App, Modal, Notice } from "obsidian";

export function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "The operation failed.";
  if (/password|decrypt|authentication|envelope|corrupt|tamper/i.test(message)) return "The password was incorrect or the encrypted record is damaged.";
  return message.replace(/[\r\n]+/g, " ").slice(0, 180);
}

export class ConfirmModal extends Modal {
  private resolvePromise?: (value: boolean) => void;
  private settled = false;

  constructor(app: App, private readonly title: string, private readonly message: string, private readonly confirmLabel = "Continue") {
    super(app);
  }

  waitForResult(): Promise<boolean> {
    this.open();
    return new Promise((resolve) => { this.resolvePromise = resolve; });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.title });
    contentEl.createEl("p", { text: this.message });
    const actions = contentEl.createDiv({ cls: "aegis-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.setAttr("aria-label", "Cancel operation");
    cancel.onclick = () => this.finish(false);
    const confirm = actions.createEl("button", { text: this.confirmLabel, cls: "mod-cta" });
    confirm.setAttr("aria-label", this.confirmLabel);
    confirm.onclick = () => this.finish(true);
  }

  onClose(): void { this.finish(false); }

  private finish(value: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.resolvePromise?.(value);
    this.close();
  }
}

export interface PasswordResult { password: string; confirmation?: string; }

export class PasswordModal extends Modal {
  private resolvePromise?: (value: PasswordResult | null) => void;
  private settled = false;

  constructor(app: App, private readonly title: string, private readonly confirmPassword: boolean) { super(app); }

  waitForResult(): Promise<PasswordResult | null> {
    this.open();
    return new Promise((resolve) => { this.resolvePromise = resolve; });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.title });
    contentEl.createEl("p", { text: "Aegis keeps this password local. Forgetting it may make encrypted content unrecoverable." });
    const form = contentEl.createEl("form");
    const passwordLabel = form.createEl("label", { text: "Password" });
    const password = passwordLabel.createEl("input", { type: "password" });
    password.setAttr("autocomplete", this.confirmPassword ? "new-password" : "current-password");
    password.setAttr("required", "true");
    password.setAttr("aria-label", "Aegis password");
    let confirmation: HTMLInputElement | undefined;
    if (this.confirmPassword) {
      const confirmLabel = form.createEl("label", { text: "Confirm password" });
      confirmation = confirmLabel.createEl("input", { type: "password" });
      confirmation.setAttr("autocomplete", "new-password");
      confirmation.setAttr("required", "true");
      confirmation.setAttr("aria-label", "Confirm Aegis password");
    }
    const error = form.createDiv({ cls: "aegis-error" });
    const actions = form.createDiv({ cls: "aegis-actions" });
    const cancel = actions.createEl("button", { text: "Cancel", type: "button" });
    cancel.onclick = () => this.finish(null);
    const submit = actions.createEl("button", { text: this.confirmPassword ? "Set password" : "Unlock", type: "submit", cls: "mod-cta" });
    form.onsubmit = (event) => {
      event.preventDefault();
      if (password.value.length < 8) { error.setText("Use at least 8 characters."); return; }
      if (this.confirmPassword && password.value !== confirmation?.value) { error.setText("Passwords do not match."); return; }
      this.finish({ password: password.value, confirmation: confirmation?.value });
    };
    window.setTimeout(() => password.focus(), 0);
    void submit;
  }

  onClose(): void { this.finish(null); }

  private finish(value: PasswordResult | null): void {
    if (this.settled) return;
    this.settled = true;
    this.resolvePromise?.(value);
    this.close();
  }
}

export interface PropertyChoice { key: string; selected: boolean; }

export class PropertyPickerModal extends Modal {
  private resolvePromise?: (value: string[] | null) => void;
  private settled = false;

  constructor(app: App, private readonly properties: PropertyChoice[]) { super(app); }

  waitForResult(): Promise<string[] | null> {
    this.open();
    return new Promise((resolve) => { this.resolvePromise = resolve; });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Choose frontmatter properties to protect" });
    contentEl.createEl("p", { text: "Only selected top-level values will be encrypted. Names remain visible so the note stays understandable." });
    const form = contentEl.createEl("form");
    const boxes: HTMLInputElement[] = [];
    for (const property of this.properties) {
      const label = form.createEl("label", { cls: "aegis-checkbox" });
      const input = label.createEl("input", { type: "checkbox" });
      input.checked = property.selected;
      input.dataset.key = property.key;
      input.setAttr("aria-label", property.key);
      boxes.push(input);
      label.createSpan({ text: property.key });
    }
    const actions = form.createDiv({ cls: "aegis-actions" });
    const cancel = actions.createEl("button", { text: "Cancel", type: "button" });
    cancel.onclick = () => this.finish(null);
    const submit = actions.createEl("button", { text: "Review", type: "submit", cls: "mod-cta" });
    form.onsubmit = (event) => { event.preventDefault(); this.finish(boxes.filter((box) => box.checked).map((box) => box.dataset.key ?? "")); };
    void submit;
  }

  onClose(): void { this.finish(null); }

  private finish(value: string[] | null): void {
    if (this.settled) return;
    this.settled = true;
    this.resolvePromise?.(value);
    this.close();
  }
}

export class ProgressModal extends Modal {
  cancelled = false;
  private status?: HTMLElement;

  constructor(app: App, private readonly total: number) { super(app); }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Locking notes" });
    this.status = contentEl.createEl("p", { text: `Preparing 0 of ${this.total}…` });
    this.status.setAttr("role", "status");
    const cancel = contentEl.createEl("button", { text: "Cancel" });
    cancel.onclick = () => { this.cancelled = true; cancel.disabled = true; cancel.setText("Cancelling…"); };
  }

  update(done: number, detail: string): void { this.status?.setText(`${detail} (${done} of ${this.total})`); }
}

export function notifyFailure(error: unknown): void { new Notice(`Aegis: ${safeError(error)}`); }

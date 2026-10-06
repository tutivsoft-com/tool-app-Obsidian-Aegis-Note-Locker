import { diagnostics } from "./diagnostics";
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
return diagnostics.guard("ui.onOpen_1", () => {
const diagnosticAction1 = () => {

    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.title });
    contentEl.createEl("p", { text: this.message });
    const actions = contentEl.createDiv({ cls: "aegis-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.setAttr("aria-label", "Cancel operation");
    cancel.onclick = diagnostics.wrap("ui.dom_1", () => this.finish(false));
    const confirm = actions.createEl("button", { text: this.confirmLabel, cls: "mod-cta" });
    confirm.setAttr("aria-label", this.confirmLabel);
    confirm.onclick = diagnostics.wrap("ui.dom_2", () => this.finish(true));

}; return diagnostics?.run ? diagnostics.run("ui.onOpen", diagnosticAction1) : diagnosticAction1();

});
}

  onClose(): void {
return diagnostics.guard("ui.onClose_2", () => {
const diagnosticAction2 = () => {
 this.finish(false);
}; return diagnostics?.run ? diagnostics.run("ui.onClose", diagnosticAction2) : diagnosticAction2();

});
}

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
return diagnostics.guard("ui.onOpen_3", () => {
const diagnosticAction3 = () => {

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
    cancel.onclick = diagnostics.wrap("ui.dom_3", () => this.finish(null));
    const submit = actions.createEl("button", { text: this.confirmPassword ? "Set password" : "Unlock", type: "submit", cls: "mod-cta" });
    form.onsubmit = diagnostics.wrap("ui.dom_4", (event) => {
      event.preventDefault();
      if (password.value.length < 8) { error.setText("Use at least 8 characters."); return; }
      if (this.confirmPassword && password.value !== confirmation?.value) { error.setText("Passwords do not match."); return; }
      this.finish({ password: password.value, confirmation: confirmation?.value });
    });
    window.setTimeout(() => diagnostics.guard("ui.timer_4", () => (password.focus())), 0);
    void submit;

}; return diagnostics?.run ? diagnostics.run("ui.onOpen", diagnosticAction3) : diagnosticAction3();

});
}

  onClose(): void {
return diagnostics.guard("ui.onClose_5", () => {
const diagnosticAction4 = () => {
 this.finish(null);
}; return diagnostics?.run ? diagnostics.run("ui.onClose", diagnosticAction4) : diagnosticAction4();

});
}

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
return diagnostics.guard("ui.onOpen_6", () => {
const diagnosticAction5 = () => {

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
    cancel.onclick = diagnostics.wrap("ui.dom_5", () => this.finish(null));
    const submit = actions.createEl("button", { text: "Review", type: "submit", cls: "mod-cta" });
    form.onsubmit = diagnostics.wrap("ui.dom_6", (event) => { event.preventDefault(); this.finish(boxes.filter((box) => box.checked).map((box) => box.dataset.key ?? "")); });
    void submit;

}; return diagnostics?.run ? diagnostics.run("ui.onOpen", diagnosticAction5) : diagnosticAction5();

});
}

  onClose(): void {
return diagnostics.guard("ui.onClose_7", () => {
const diagnosticAction6 = () => {
 this.finish(null);
}; return diagnostics?.run ? diagnostics.run("ui.onClose", diagnosticAction6) : diagnosticAction6();

});
}

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
return diagnostics.guard("ui.onOpen_8", () => {
const diagnosticAction7 = () => {

    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Locking notes" });
    this.status = contentEl.createEl("p", { text: `Preparing 0 of ${this.total}…` });
    this.status.setAttr("role", "status");
    const cancel = contentEl.createEl("button", { text: "Cancel" });
    cancel.onclick = diagnostics.wrap("ui.dom_7", () => { this.cancelled = true; cancel.disabled = true; cancel.setText("Cancelling…"); });

}; return diagnostics?.run ? diagnostics.run("ui.onOpen", diagnosticAction7) : diagnosticAction7();

});
}

  update(done: number, detail: string): void { this.status?.setText(`${detail} (${done} of ${this.total})`); }
}

export function notifyFailure(error: unknown): void { new Notice(`Aegis: ${safeError(error)}`); }

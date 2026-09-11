"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// publish/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AegisNoteLockerPlugin
});
module.exports = __toCommonJS(main_exports);

// publish/src/main.ts
var import_obsidian4 = require("obsidian");

// publish/src/crypto.ts
var AEGIS_FORMAT_VERSION = 1;
var DEFAULT_PBKDF2_ITERATIONS = 31e4;
function cryptoApi() {
  var _a;
  if (!((_a = globalThis.crypto) == null ? void 0 : _a.subtle)) throw new Error("Web Crypto is unavailable in this runtime.");
  return globalThis.crypto;
}
function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function randomBytes(length) {
  const result = new Uint8Array(length);
  cryptoApi().getRandomValues(result);
  return result;
}
function source(bytes) {
  return bytes;
}
async function deriveKey(password, salt, iterations) {
  const material = await cryptoApi().subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return cryptoApi().subtle.deriveKey(
    { name: "PBKDF2", salt: source(salt), iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
function validateEnvelope(value) {
  if (!value || typeof value !== "object") throw new Error("Invalid Aegis envelope.");
  const envelope = value;
  if (envelope.v !== AEGIS_FORMAT_VERSION || envelope.alg !== "AES-256-GCM" || envelope.kdf !== "PBKDF2-HMAC-SHA256" || typeof envelope.iterations !== "number" || envelope.iterations < 1e5 || typeof envelope.salt !== "string" || typeof envelope.iv !== "string" || typeof envelope.ciphertext !== "string" || typeof envelope.tag !== "string") {
    throw new Error("Unsupported or malformed Aegis envelope.");
  }
}
async function encryptText(plaintext, password, iterations = DEFAULT_PBKDF2_ITERATIONS) {
  if (!password) throw new Error("A password is required.");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt, iterations);
  const encrypted = await cryptoApi().subtle.encrypt(
    { name: "AES-GCM", iv: source(iv) },
    key,
    new TextEncoder().encode(plaintext)
  );
  const encryptedBytes = new Uint8Array(encrypted);
  const tagLength = 16;
  return {
    v: AEGIS_FORMAT_VERSION,
    alg: "AES-256-GCM",
    kdf: "PBKDF2-HMAC-SHA256",
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(encryptedBytes.slice(0, -tagLength)),
    tag: bytesToBase64(encryptedBytes.slice(-tagLength))
  };
}
async function decryptText(envelope, password) {
  validateEnvelope(envelope);
  if (!password) throw new Error("A password is required.");
  const key = await deriveKey(password, base64ToBytes(envelope.salt), envelope.iterations);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const tag = base64ToBytes(envelope.tag);
  const ciphertextAndTag = new Uint8Array(ciphertext.length + tag.length);
  ciphertextAndTag.set(ciphertext);
  ciphertextAndTag.set(tag, ciphertext.length);
  const plaintext = await cryptoApi().subtle.decrypt(
    { name: "AES-GCM", iv: source(base64ToBytes(envelope.iv)) },
    key,
    source(ciphertextAndTag)
  );
  return new TextDecoder().decode(plaintext);
}
async function sha256Hex(value) {
  const digest = await cryptoApi().subtle.digest("SHA-256", source(new TextEncoder().encode(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// publish/src/frontmatter.ts
var import_obsidian = require("obsidian");
var AEGIS_KEY = "aegis";
function parseMarkdown(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {}, body: content, hasFrontmatter: false };
  const parsed = (0, import_obsidian.parseYaml)(match[1]);
  return {
    frontmatter: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {},
    body: content.slice(match[0].length),
    hasFrontmatter: true
  };
}
function serializeMarkdown(frontmatter, body) {
  if (Object.keys(frontmatter).length === 0) return body;
  const yaml = (0, import_obsidian.stringifyYaml)(frontmatter).trimEnd();
  return `---
${yaml}
---
${body}`;
}
function topLevelPropertyNames(frontmatter) {
  return Object.keys(frontmatter).filter((key) => key !== AEGIS_KEY && !key.startsWith("aegis-"));
}

// publish/src/settings.ts
var import_obsidian2 = require("obsidian");

// publish/src/types.ts
var DEFAULT_SETTINGS = {
  sessionTimeoutMinutes: 15,
  backupFolder: ".aegis-backups",
  showStatusBar: true
};

// publish/src/settings.ts
var AegisSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin", plugin);
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Aegis Note Locker" });
    containerEl.createEl("p", { text: "All encryption is local. Aegis never sends passwords or protected content to a server." });
    new import_obsidian2.Setting(containerEl).setName("Session timeout").setDesc("Minutes of inactivity before the in-memory unlock password is cleared.").addSlider((slider) => slider.setLimits(1, 120, 1).setValue(this.plugin.settings.sessionTimeoutMinutes).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.sessionTimeoutMinutes = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Encrypted backup folder").setDesc("Vault-relative folder used for user-requested encrypted exports.").addText((text) => text.setPlaceholder(".aegis-backups").setValue(this.plugin.settings.backupFolder).onChange(async (value) => {
      this.plugin.settings.backupFolder = value.trim() || ".aegis-backups";
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Show status bar").setDesc("Show the current note's locked or unlocked state in the status bar.").addToggle((toggle) => toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
      this.plugin.settings.showStatusBar = value;
      await this.plugin.saveSettings();
      this.plugin.updateStatusBar();
    }));
    containerEl.createEl("h3", { text: "Recovery" });
    containerEl.createEl("p", { text: "Use Export encrypted backup before migrations or sync changes. Rollback is available for the last operation while this plugin session still holds its volatile undo record." });
  }
};

// publish/src/safety.ts
function assertNoConflict(expected, current) {
  if (expected !== current) throw new Error("The note changed on disk; resolve the sync conflict before retrying.");
}
function temporaryPath(path) {
  return `${path}.aegis-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
}

// publish/src/ui.ts
var import_obsidian3 = require("obsidian");
function safeError(error) {
  const message = error instanceof Error ? error.message : "The operation failed.";
  if (/password|decrypt|authentication|envelope|corrupt|tamper/i.test(message)) return "The password was incorrect or the encrypted record is damaged.";
  return message.replace(/[\r\n]+/g, " ").slice(0, 180);
}
var ConfirmModal = class extends import_obsidian3.Modal {
  constructor(app, title, message, confirmLabel = "Continue") {
    super(app);
    __publicField(this, "title", title);
    __publicField(this, "message", message);
    __publicField(this, "confirmLabel", confirmLabel);
    __publicField(this, "resolvePromise");
    __publicField(this, "settled", false);
  }
  waitForResult() {
    this.open();
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }
  onOpen() {
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
  onClose() {
    this.finish(false);
  }
  finish(value) {
    var _a;
    if (this.settled) return;
    this.settled = true;
    (_a = this.resolvePromise) == null ? void 0 : _a.call(this, value);
    this.close();
  }
};
var PasswordModal = class extends import_obsidian3.Modal {
  constructor(app, title, confirmPassword) {
    super(app);
    __publicField(this, "title", title);
    __publicField(this, "confirmPassword", confirmPassword);
    __publicField(this, "resolvePromise");
    __publicField(this, "settled", false);
  }
  waitForResult() {
    this.open();
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }
  onOpen() {
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
    let confirmation;
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
      if (password.value.length < 8) {
        error.setText("Use at least 8 characters.");
        return;
      }
      if (this.confirmPassword && password.value !== (confirmation == null ? void 0 : confirmation.value)) {
        error.setText("Passwords do not match.");
        return;
      }
      this.finish({ password: password.value, confirmation: confirmation == null ? void 0 : confirmation.value });
    };
    window.setTimeout(() => password.focus(), 0);
    void submit;
  }
  onClose() {
    this.finish(null);
  }
  finish(value) {
    var _a;
    if (this.settled) return;
    this.settled = true;
    (_a = this.resolvePromise) == null ? void 0 : _a.call(this, value);
    this.close();
  }
};
var PropertyPickerModal = class extends import_obsidian3.Modal {
  constructor(app, properties) {
    super(app);
    __publicField(this, "properties", properties);
    __publicField(this, "resolvePromise");
    __publicField(this, "settled", false);
  }
  waitForResult() {
    this.open();
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Choose frontmatter properties to protect" });
    contentEl.createEl("p", { text: "Only selected top-level values will be encrypted. Names remain visible so the note stays understandable." });
    const form = contentEl.createEl("form");
    const boxes = [];
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
    form.onsubmit = (event) => {
      event.preventDefault();
      this.finish(boxes.filter((box) => box.checked).map((box) => {
        var _a;
        return (_a = box.dataset.key) != null ? _a : "";
      }));
    };
    void submit;
  }
  onClose() {
    this.finish(null);
  }
  finish(value) {
    var _a;
    if (this.settled) return;
    this.settled = true;
    (_a = this.resolvePromise) == null ? void 0 : _a.call(this, value);
    this.close();
  }
};
var ProgressModal = class extends import_obsidian3.Modal {
  constructor(app, total) {
    super(app);
    __publicField(this, "total", total);
    __publicField(this, "cancelled", false);
    __publicField(this, "status");
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Locking notes" });
    this.status = contentEl.createEl("p", { text: `Preparing 0 of ${this.total}\u2026` });
    this.status.setAttr("role", "status");
    const cancel = contentEl.createEl("button", { text: "Cancel" });
    cancel.onclick = () => {
      this.cancelled = true;
      cancel.disabled = true;
      cancel.setText("Cancelling\u2026");
    };
  }
  update(done, detail) {
    var _a;
    (_a = this.status) == null ? void 0 : _a.setText(`${detail} (${done} of ${this.total})`);
  }
};
function notifyFailure(error) {
  new import_obsidian3.Notice(`Aegis: ${safeError(error)}`);
}

// publish/src/main.ts
var LOCKED_NOTE_PLACEHOLDER = "> \u{1F512} Aegis: note body locked. Use \u201CAegis: Unlock current note\u201D to view it.";
var LOCKED_PROPERTY_PLACEHOLDER = "\u{1F512} Protected by Aegis";
function asRecord(value) {
  if (!value || typeof value !== "object") return null;
  const record = value;
  if (record.mode !== "note" && record.mode !== "properties") return null;
  return record;
}
function isMarkdown(file) {
  return file.extension.toLowerCase() === "md";
}
var AegisNoteLockerPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", { ...DEFAULT_SETTINGS });
    __publicField(this, "sessionPassword");
    __publicField(this, "sessionExpiresAt", 0);
    __publicField(this, "undoRecord");
    __publicField(this, "statusBar");
    __publicField(this, "activeProgress");
  }
  async onload() {
    await this.loadSettings();
    if (this.settings.showStatusBar) this.statusBar = this.addStatusBarItem();
    this.addRibbonIcon("lock", "Aegis: Lock current note", () => void this.lockCurrentNote());
    this.addCommand({ id: "lock-current-note", name: "Aegis: Lock current note", callback: () => void this.lockCurrentNote() });
    this.addCommand({ id: "unlock-current-note", name: "Aegis: Unlock current note", callback: () => void this.unlockCurrentNote() });
    this.addCommand({ id: "lock-frontmatter-properties", name: "Aegis: Lock selected frontmatter properties", callback: () => void this.lockProperties() });
    this.addCommand({ id: "lock-all-notes", name: "Aegis: Lock all Markdown notes", callback: () => void this.lockAllNotes() });
    this.addCommand({ id: "lock-now", name: "Aegis: Lock now (clear session)", callback: () => this.lockNow() });
    this.addCommand({ id: "rollback-last-operation", name: "Aegis: Roll back last operation", callback: () => void this.rollbackLastOperation() });
    this.addCommand({ id: "export-encrypted-backup", name: "Aegis: Export encrypted backup of current note", callback: () => void this.exportEncryptedBackup() });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => this.addFileMenuItems(menu, file)));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor) => this.addEditorMenuItems(menu, editor)));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateStatusBar()));
    this.registerInterval(window.setInterval(() => this.expireSessionIfNeeded(), 3e4));
    this.addSettingTab(new AegisSettingTab(this.app, this));
    this.updateStatusBar();
  }
  onunload() {
    this.lockNow();
  }
  async loadSettings() {
    const saved = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...saved != null ? saved : {} };
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  updateStatusBar() {
    var _a, _b;
    if (!this.settings.showStatusBar) {
      (_a = this.statusBar) == null ? void 0 : _a.setText("");
      return;
    }
    const file = this.currentFile();
    if (!file || !isMarkdown(file)) {
      (_b = this.statusBar) == null ? void 0 : _b.setText("Aegis: no note");
      return;
    }
    void this.app.vault.read(file).then((content) => {
      var _a2;
      const record = asRecord(parseMarkdown(content).frontmatter[AEGIS_KEY]);
      (_a2 = this.statusBar) == null ? void 0 : _a2.setText((record == null ? void 0 : record.mode) === "note" ? "Aegis: body locked" : (record == null ? void 0 : record.mode) === "properties" ? "Aegis: properties protected" : "Aegis: unlocked");
    }).catch(() => {
      var _a2;
      return (_a2 = this.statusBar) == null ? void 0 : _a2.setText("Aegis: unavailable");
    });
  }
  addFileMenuItems(menu, file) {
    if (!(file instanceof import_obsidian4.TFile) || !isMarkdown(file)) return;
    menu.addItem((item) => item.setTitle("Aegis: Lock note").setIcon("lock").onClick(() => void this.lockCurrentNote(file)));
    menu.addItem((item) => item.setTitle("Aegis: Unlock note").setIcon("unlock").onClick(() => void this.unlockCurrentNote(file)));
    menu.addItem((item) => item.setTitle("Aegis: Lock frontmatter properties").onClick(() => void this.lockProperties(file)));
    menu.addItem((item) => item.setTitle("Aegis: Export encrypted backup").onClick(() => void this.exportEncryptedBackup(file)));
  }
  addEditorMenuItems(menu, _editor) {
    menu.addItem((item) => item.setTitle("Aegis: Lock current note").setIcon("lock").onClick(() => void this.lockCurrentNote()));
    menu.addItem((item) => item.setTitle("Aegis: Unlock current note").setIcon("unlock").onClick(() => void this.unlockCurrentNote()));
  }
  currentFile() {
    return this.app.workspace.getActiveFile();
  }
  async passwordForNewEncryption() {
    const result = await new PasswordModal(this.app, "Set Aegis password", true).waitForResult();
    if (!result) return null;
    this.setSessionPassword(result.password);
    return result.password;
  }
  async passwordForUnlock() {
    if (this.sessionPassword && Date.now() < this.sessionExpiresAt) {
      this.touchSession();
      return this.sessionPassword;
    }
    this.clearSession();
    const result = await new PasswordModal(this.app, "Unlock with Aegis password", false).waitForResult();
    if (!result) return null;
    this.setSessionPassword(result.password);
    return result.password;
  }
  setSessionPassword(password) {
    this.sessionPassword = password;
    this.touchSession();
  }
  touchSession() {
    this.sessionExpiresAt = Date.now() + this.settings.sessionTimeoutMinutes * 6e4;
  }
  expireSessionIfNeeded() {
    if (this.sessionPassword && Date.now() >= this.sessionExpiresAt) {
      this.clearSession();
      new import_obsidian4.Notice("Aegis session expired. Encrypted notes are locked.");
    }
  }
  lockNow() {
    this.sessionPassword = void 0;
    this.sessionExpiresAt = 0;
    this.undoRecord = void 0;
    this.updateStatusBar();
  }
  clearSession() {
    this.sessionPassword = void 0;
    this.sessionExpiresAt = 0;
    this.undoRecord = void 0;
  }
  async lockCurrentNote(file = this.currentFile()) {
    if (!file || !isMarkdown(file)) {
      new import_obsidian4.Notice("Aegis: open a Markdown note first.");
      return;
    }
    try {
      const original = await this.app.vault.read(file);
      const parsed = parseMarkdown(original);
      if (asRecord(parsed.frontmatter[AEGIS_KEY])) {
        new import_obsidian4.Notice("Aegis: this note already has protected content.");
        return;
      }
      const preview = await new ConfirmModal(this.app, "Review note lock", `The note body will become unreadable to Markdown search and third-party plugins. Its path and frontmatter will remain. A volatile undo record will be held for this session.`, "Continue to password").waitForResult();
      if (!preview) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const envelope = await encryptText(parsed.body, password);
      const verified = await decryptText(envelope, password);
      if (verified !== parsed.body) throw new Error("Aegis verification failed before the file was changed.");
      const next = serializeMarkdown({ ...parsed.frontmatter, [AEGIS_KEY]: { mode: "note", envelope } }, LOCKED_NOTE_PLACEHOLDER);
      await this.atomicChange(file, original, next);
      new import_obsidian4.Notice("Aegis: note locked.");
    } catch (error) {
      notifyFailure(error);
    }
  }
  async lockProperties(file = this.currentFile()) {
    var _a, _b;
    if (!file || !isMarkdown(file)) {
      new import_obsidian4.Notice("Aegis: open a Markdown note first.");
      return;
    }
    try {
      const original = await this.app.vault.read(file);
      const parsed = parseMarkdown(original);
      if (((_a = asRecord(parsed.frontmatter[AEGIS_KEY])) == null ? void 0 : _a.mode) === "note") {
        new import_obsidian4.Notice("Aegis: unlock the note body before protecting properties.");
        return;
      }
      const existing = asRecord(parsed.frontmatter[AEGIS_KEY]);
      const keys = topLevelPropertyNames(parsed.frontmatter).filter((key) => {
        var _a2;
        return !((_a2 = existing == null ? void 0 : existing.properties) == null ? void 0 : _a2[key]);
      });
      if (!keys.length) {
        new import_obsidian4.Notice("Aegis: this note has no top-level frontmatter properties.");
        return;
      }
      const chosen = await new PropertyPickerModal(this.app, keys.map((key) => ({ key, selected: false }))).waitForResult();
      if (!(chosen == null ? void 0 : chosen.length)) return;
      const preview = await new ConfirmModal(this.app, "Review property lock", `Protect ${chosen.length} frontmatter propert${chosen.length === 1 ? "y" : "ies"}? Names stay visible; values will be replaced with a non-sensitive placeholder.`, "Continue to password").waitForResult();
      if (!preview) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const protectedValues = { ...(_b = existing == null ? void 0 : existing.properties) != null ? _b : {} };
      const updatedFrontmatter = { ...parsed.frontmatter };
      for (const key of chosen) {
        protectedValues[key] = await encryptText(JSON.stringify(parsed.frontmatter[key]), password);
        updatedFrontmatter[key] = LOCKED_PROPERTY_PLACEHOLDER;
      }
      const nextRecord = { mode: "properties", properties: protectedValues };
      const next = serializeMarkdown({ ...updatedFrontmatter, [AEGIS_KEY]: nextRecord }, parsed.body);
      await this.atomicChange(file, original, next);
      new import_obsidian4.Notice(`Aegis: protected ${chosen.length} propert${chosen.length === 1 ? "y" : "ies"}.`);
    } catch (error) {
      notifyFailure(error);
    }
  }
  async unlockCurrentNote(file = this.currentFile()) {
    if (!file || !isMarkdown(file)) {
      new import_obsidian4.Notice("Aegis: open a Markdown note first.");
      return;
    }
    try {
      const original = await this.app.vault.read(file);
      const parsed = parseMarkdown(original);
      const record = asRecord(parsed.frontmatter[AEGIS_KEY]);
      if (!record) {
        new import_obsidian4.Notice("Aegis: this note is not locked.");
        return;
      }
      const preview = await new ConfirmModal(this.app, "Review unlock", "The encrypted record will be verified before the note is replaced. Nothing changes if the password is wrong or the file changed on disk.", "Continue to unlock").waitForResult();
      if (!preview) return;
      const password = await this.passwordForUnlock();
      if (!password) return;
      const nextFrontmatter = { ...parsed.frontmatter };
      delete nextFrontmatter[AEGIS_KEY];
      let nextBody = parsed.body;
      if (record.mode === "note" && record.envelope) {
        nextBody = await decryptText(record.envelope, password);
      } else if (record.mode === "properties" && record.properties) {
        for (const [key, envelope] of Object.entries(record.properties)) nextFrontmatter[key] = JSON.parse(await decryptText(envelope, password));
      } else throw new Error("Unsupported Aegis record.");
      const next = serializeMarkdown(nextFrontmatter, nextBody);
      await this.atomicChange(file, original, next);
      new import_obsidian4.Notice("Aegis: note unlocked.");
    } catch (error) {
      notifyFailure(error);
    }
  }
  async lockAllNotes() {
    var _a;
    try {
      const files = this.app.vault.getMarkdownFiles();
      const candidates = [];
      for (const file of files) {
        const content = await this.app.vault.read(file);
        if (!asRecord(parseMarkdown(content).frontmatter[AEGIS_KEY])) candidates.push(file);
      }
      if (!candidates.length) {
        new import_obsidian4.Notice("Aegis: no unlocked Markdown notes found.");
        return;
      }
      const approved = await new ConfirmModal(this.app, "Review lock-all operation", `${candidates.length} Markdown notes will be encrypted. Each file is checked for sync conflicts and verified before replacement.`, "Continue to password").waitForResult();
      if (!approved) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const progress = new ProgressModal(this.app, candidates.length);
      this.activeProgress = progress;
      progress.open();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const entries = [];
      for (let index = 0; index < candidates.length; index++) {
        if (progress.cancelled) break;
        const file = candidates[index];
        progress.update(index, file.path);
        try {
          const original = await this.app.vault.read(file);
          const parsed = parseMarkdown(original);
          if (asRecord(parsed.frontmatter[AEGIS_KEY])) continue;
          const envelope = await encryptText(parsed.body, password);
          if (await decryptText(envelope, password) !== parsed.body) throw new Error("verification failed");
          const next = serializeMarkdown({ ...parsed.frontmatter, [AEGIS_KEY]: { mode: "note", envelope } }, LOCKED_NOTE_PLACEHOLDER);
          await this.atomicChange(file, original, next, false);
          entries.push({ path: file.path, original, resulting: next });
        } catch (error) {
          new import_obsidian4.Notice(`Aegis skipped ${file.path}: ${error instanceof Error ? error.message : "operation failed"}`);
        }
      }
      progress.update(entries.length, progress.cancelled ? "Cancelled" : "Complete");
      progress.close();
      this.activeProgress = void 0;
      if (entries.length) this.undoRecord = { createdAt: Date.now(), entries };
      new import_obsidian4.Notice(`Aegis: locked ${entries.length} note(s)${progress.cancelled ? " before cancellation" : ""}.`);
    } catch (error) {
      (_a = this.activeProgress) == null ? void 0 : _a.close();
      this.activeProgress = void 0;
      notifyFailure(error);
    }
  }
  async exportEncryptedBackup(file = this.currentFile()) {
    if (!file || !isMarkdown(file)) {
      new import_obsidian4.Notice("Aegis: open a Markdown note first.");
      return;
    }
    try {
      const original = await this.app.vault.read(file);
      const approved = await new ConfirmModal(this.app, "Export encrypted backup", "Aegis will write an encrypted copy into the configured vault backup folder. The backup will not contain your password.", "Choose password").waitForResult();
      if (!approved) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const envelope = await encryptText(original, password);
      const folder = this.settings.backupFolder.replace(/^\/+|\/+$/g, "") || ".aegis-backups";
      if (!await this.app.vault.adapter.exists(folder)) await this.app.vault.adapter.mkdir(folder);
      const digest = (await sha256Hex(file.path)).slice(0, 16);
      const backupPath = `${folder}/${digest}-${Date.now()}.aegis`;
      await this.app.vault.adapter.write(backupPath, JSON.stringify({ v: 1, sourceHash: await sha256Hex(file.path), sourcePath: file.path, envelope }, null, 2));
      new import_obsidian4.Notice(`Aegis: encrypted backup written to ${backupPath}.`);
    } catch (error) {
      notifyFailure(error);
    }
  }
  async rollbackLastOperation() {
    const record = this.undoRecord;
    if (!(record == null ? void 0 : record.entries.length)) {
      new import_obsidian4.Notice("Aegis: no volatile undo record is available.");
      return;
    }
    const approved = await new ConfirmModal(this.app, "Roll back last Aegis operation", `Restore ${record.entries.length} original note(s)? Aegis will refuse if any file changed since the operation.`, "Roll back").waitForResult();
    if (!approved) return;
    let restored = 0;
    for (const entry of record.entries) {
      const file = this.app.vault.getAbstractFileByPath(entry.path);
      if (!(file instanceof import_obsidian4.TFile)) continue;
      try {
        await this.atomicChange(file, entry.resulting, entry.original, false);
        restored++;
      } catch (e) {
        new import_obsidian4.Notice(`Aegis: rollback refused for ${entry.path} because it changed.`);
      }
    }
    this.undoRecord = void 0;
    new import_obsidian4.Notice(`Aegis: rolled back ${restored} note(s).`);
  }
  async atomicChange(file, expected, next, recordUndo = true) {
    const current = await this.app.vault.read(file);
    assertNoConflict(expected, current);
    const tempPath = temporaryPath(file.path);
    try {
      await this.app.vault.adapter.write(tempPath, next);
      const staged = await this.app.vault.adapter.read(tempPath);
      if (staged !== next) throw new Error("Staged file verification failed.");
      await this.app.vault.adapter.rename(tempPath, file.path);
      const committed = await this.app.vault.read(file);
      if (committed !== next) throw new Error("Committed file verification failed.");
      if (recordUndo) this.undoRecord = { createdAt: Date.now(), entries: [{ path: file.path, original: expected, resulting: next }] };
    } catch (error) {
      if (await this.app.vault.adapter.exists(tempPath)) await this.app.vault.adapter.remove(tempPath).catch(() => void 0);
      throw error;
    }
  }
};

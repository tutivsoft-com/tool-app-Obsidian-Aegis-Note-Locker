import { Menu, Notice, Plugin, TFile, type Editor, type TAbstractFile } from "obsidian";
import { decryptText, encryptText, sha256Hex } from "./crypto";
import { AEGIS_KEY, displayValue, parseMarkdown, serializeMarkdown, topLevelPropertyNames } from "./frontmatter";
import { DEFAULT_SETTINGS, AegisSettingTab } from "./settings";
import { assertNoConflict, temporaryPath } from "./safety";
import { ConfirmModal, PasswordModal, ProgressModal, PropertyPickerModal, notifyFailure } from "./ui";
import { initializeBilling, reserveProtectionUse, syncBalance, type ProtectionCommitResult, type UseReservation } from "./billing";
import type { AegisRecord, AegisSettings, UndoEntry, UndoRecord } from "./types";
import { PluginSupport } from "./plugin-support";

const LOCKED_NOTE_PLACEHOLDER = "> 🔒 Aegis: note body locked. Use “Aegis: Unlock current note” to view it.";
const LOCKED_PROPERTY_PLACEHOLDER = "🔒 Protected by Aegis";

function asRecord(value: unknown): AegisRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<AegisRecord>;
  if (record.mode !== "note" && record.mode !== "properties") return null;
  return record as AegisRecord;
}

function isMarkdown(file: TFile): boolean { return file.extension.toLowerCase() === "md"; }

export default class AegisNoteLockerPlugin extends Plugin {
  settings: AegisSettings = { ...DEFAULT_SETTINGS };
  support!: PluginSupport;
  private sessionPassword: string | undefined;
  private sessionExpiresAt = 0;
  private undoRecord: UndoRecord | undefined;
  private statusBar?: HTMLElement;
  private activeProgress?: ProgressModal;

  async onload(): Promise<void> {
    this.support = new PluginSupport(this, { name: "Aegis Note Locker", summary: "Encrypt note bodies or selected frontmatter properties with review and rollback safeguards.", quickStart: ["Open a note.", "Run Lock current note or Lock frontmatter properties.", "Review the scope and enter a password."], commands: ["Lock current note", "Unlock current note", "Clear password session"], troubleshooting: ["Use Copy debug log before reporting a problem.", "Keep the password safe; Aegis cannot recover it."] });
    this.support.start();
    await this.loadSettings();
    await initializeBilling(this);
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
    this.registerInterval(window.setInterval(() => this.expireSessionIfNeeded(), 30_000));
    this.addSettingTab(new AegisSettingTab(this.app, this));
    this.updateStatusBar();
  }

  onunload(): void { this.lockNow(); }

  async loadSettings(): Promise<void> {
    const saved = await this.loadData() as Partial<AegisSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
    this.settings.constanceDeviceId = typeof this.settings.constanceDeviceId === "string" ? this.settings.constanceDeviceId : "";
    this.settings.billingEmail = typeof this.settings.billingEmail === "string" ? this.settings.billingEmail : "";
    this.settings.billingAccessToken = typeof this.settings.billingAccessToken === "string" ? this.settings.billingAccessToken : "";
    this.settings.billingRefreshToken = typeof this.settings.billingRefreshToken === "string" ? this.settings.billingRefreshToken : "";
    this.settings.billingAccountLinked = this.settings.billingAccountLinked === true && Boolean(this.settings.billingAccessToken);
    this.settings.freeUsesDay = typeof this.settings.freeUsesDay === "string" ? this.settings.freeUsesDay : "";
    this.settings.freeUsesUsed = Number.isFinite(this.settings.freeUsesUsed) ? Math.max(0, Math.floor(this.settings.freeUsesUsed)) : 0;
    this.settings.purchasedUses = Number.isFinite(this.settings.purchasedUses) ? Math.max(0, Math.floor(this.settings.purchasedUses)) : 0;
    this.settings.pendingProtectionCharges = Array.isArray(this.settings.pendingProtectionCharges) ? this.settings.pendingProtectionCharges.filter((id): id is string => typeof id === "string") : [];
    this.settings.pendingCheckoutKey = typeof this.settings.pendingCheckoutKey === "string" ? this.settings.pendingCheckoutKey : "";
    this.settings.pendingCheckoutPack = typeof this.settings.pendingCheckoutPack === "string" ? this.settings.pendingCheckoutPack : "";
  }

  async saveSettings(): Promise<void> { await this.saveData(this.settings); }

  pollAfterCheckout(): void {
    let attempts = 0;
    const interval = this.registerInterval(window.setInterval(() => {
      attempts += 1;
      void syncBalance(this);
      if (attempts >= 6) window.clearInterval(interval);
    }, 15_000));
  }

  updateStatusBar(): void {
    if (!this.settings.showStatusBar) { this.statusBar?.setText(""); return; }
    const file = this.currentFile();
    if (!file || !isMarkdown(file)) { this.statusBar?.setText("Aegis: no note"); return; }
    void this.app.vault.read(file).then((content) => {
      const record = asRecord(parseMarkdown(content).frontmatter[AEGIS_KEY]);
      this.statusBar?.setText(record?.mode === "note" ? "Aegis: body locked" : record?.mode === "properties" ? "Aegis: properties protected" : "Aegis: unlocked");
    }).catch(() => this.statusBar?.setText("Aegis: unavailable"));
  }

  private addFileMenuItems(menu: Menu, file: TAbstractFile): void {
    if (!(file instanceof TFile) || !isMarkdown(file)) return;
    menu.addItem((item) => item.setTitle("Aegis: Lock note").setIcon("lock").onClick(() => void this.lockCurrentNote(file)));
    menu.addItem((item) => item.setTitle("Aegis: Unlock note").setIcon("unlock").onClick(() => void this.unlockCurrentNote(file)));
    menu.addItem((item) => item.setTitle("Aegis: Lock frontmatter properties").onClick(() => void this.lockProperties(file)));
    menu.addItem((item) => item.setTitle("Aegis: Export encrypted backup").onClick(() => void this.exportEncryptedBackup(file)));
  }

  private addEditorMenuItems(menu: Menu, _editor: Editor): void {
    menu.addItem((item) => item.setTitle("Aegis: Lock current note").setIcon("lock").onClick(() => void this.lockCurrentNote()));
    menu.addItem((item) => item.setTitle("Aegis: Unlock current note").setIcon("unlock").onClick(() => void this.unlockCurrentNote()));
  }

  private currentFile(): TFile | null { return this.app.workspace.getActiveFile(); }

  private async passwordForNewEncryption(): Promise<string | null> {
    const result = await new PasswordModal(this.app, "Set Aegis password", true).waitForResult();
    if (!result) return null;
    this.setSessionPassword(result.password);
    return result.password;
  }

  private async passwordForUnlock(): Promise<string | null> {
    if (this.sessionPassword && Date.now() < this.sessionExpiresAt) { this.touchSession(); return this.sessionPassword; }
    this.clearSession();
    const result = await new PasswordModal(this.app, "Unlock with Aegis password", false).waitForResult();
    if (!result) return null;
    this.setSessionPassword(result.password);
    return result.password;
  }

  private setSessionPassword(password: string): void { this.sessionPassword = password; this.touchSession(); }
  private touchSession(): void { this.sessionExpiresAt = Date.now() + this.settings.sessionTimeoutMinutes * 60_000; }
  private expireSessionIfNeeded(): void { if (this.sessionPassword && Date.now() >= this.sessionExpiresAt) { this.clearSession(); new Notice("Aegis session expired. Encrypted notes are locked."); } }
  lockNow(): void { this.sessionPassword = undefined; this.sessionExpiresAt = 0; this.undoRecord = undefined; this.updateStatusBar(); }
  private clearSession(): void { this.sessionPassword = undefined; this.sessionExpiresAt = 0; this.undoRecord = undefined; }

  private async lockCurrentNote(file = this.currentFile()): Promise<void> {
    if (!file || !isMarkdown(file)) { new Notice("Aegis: open a Markdown note first."); return; }
    try {
      const original = await this.app.vault.read(file);
      const parsed = parseMarkdown(original);
      if (asRecord(parsed.frontmatter[AEGIS_KEY])) { new Notice("Aegis: this note already has protected content."); return; }
      const preview = await new ConfirmModal(this.app, "Review note lock", `The note body will become unreadable to Markdown search and third-party plugins. Its path and frontmatter will remain. A volatile undo record will be held for this session.`, "Continue to password").waitForResult();
      if (!preview) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const envelope = await encryptText(parsed.body, password);
      const verified = await decryptText(envelope, password);
      if (verified !== parsed.body) throw new Error("Aegis verification failed before the file was changed.");
      const next = serializeMarkdown({ ...parsed.frontmatter, [AEGIS_KEY]: { mode: "note", envelope } satisfies AegisRecord }, LOCKED_NOTE_PLACEHOLDER);
      const reservation = await reserveProtectionUse(this);
      if (!reservation) return;
      await this.applyProtectionChange(file, original, next, reservation, "Aegis: note locked.");
    } catch (error) { notifyFailure(error); }
  }

  private async lockProperties(file = this.currentFile()): Promise<void> {
    if (!file || !isMarkdown(file)) { new Notice("Aegis: open a Markdown note first."); return; }
    try {
      const original = await this.app.vault.read(file);
      const parsed = parseMarkdown(original);
      if (asRecord(parsed.frontmatter[AEGIS_KEY])?.mode === "note") { new Notice("Aegis: unlock the note body before protecting properties."); return; }
      const existing = asRecord(parsed.frontmatter[AEGIS_KEY]);
      const keys = topLevelPropertyNames(parsed.frontmatter).filter((key) => !existing?.properties?.[key]);
      if (!keys.length) { new Notice("Aegis: this note has no top-level frontmatter properties."); return; }
      const chosen = await new PropertyPickerModal(this.app, keys.map((key) => ({ key, selected: false }))).waitForResult();
      if (!chosen?.length) return;
      const preview = await new ConfirmModal(this.app, "Review property lock", `Protect ${chosen.length} frontmatter propert${chosen.length === 1 ? "y" : "ies"}? Names stay visible; values will be replaced with a non-sensitive placeholder.`, "Continue to password").waitForResult();
      if (!preview) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const protectedValues = { ...(existing?.properties ?? {}) };
      const updatedFrontmatter = { ...parsed.frontmatter };
      for (const key of chosen) {
        protectedValues[key] = await encryptText(JSON.stringify(parsed.frontmatter[key]), password);
        updatedFrontmatter[key] = LOCKED_PROPERTY_PLACEHOLDER;
      }
      const nextRecord: AegisRecord = { mode: "properties", properties: protectedValues };
      const next = serializeMarkdown({ ...updatedFrontmatter, [AEGIS_KEY]: nextRecord }, parsed.body);
      const reservation = await reserveProtectionUse(this);
      if (!reservation) return;
      await this.applyProtectionChange(file, original, next, reservation, `Aegis: protected ${chosen.length} propert${chosen.length === 1 ? "y" : "ies"}.`);
    } catch (error) { notifyFailure(error); }
  }

  private async unlockCurrentNote(file = this.currentFile()): Promise<void> {
    if (!file || !isMarkdown(file)) { new Notice("Aegis: open a Markdown note first."); return; }
    try {
      const original = await this.app.vault.read(file);
      const parsed = parseMarkdown(original);
      const record = asRecord(parsed.frontmatter[AEGIS_KEY]);
      if (!record) { new Notice("Aegis: this note is not locked."); return; }
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
      new Notice("Aegis: note unlocked.");
    } catch (error) { notifyFailure(error); }
  }

  private async lockAllNotes(): Promise<void> {
    try {
      const files = this.app.vault.getMarkdownFiles();
      const candidates: TFile[] = [];
      for (const file of files) { const content = await this.app.vault.read(file); if (!asRecord(parseMarkdown(content).frontmatter[AEGIS_KEY])) candidates.push(file); }
      if (!candidates.length) { new Notice("Aegis: no unlocked Markdown notes found."); return; }
      const approved = await new ConfirmModal(this.app, "Review lock-all operation", `${candidates.length} Markdown notes will be encrypted. Each file is checked for sync conflicts and verified before replacement.`, "Continue to password").waitForResult();
      if (!approved) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const progress = new ProgressModal(this.app, candidates.length);
      this.activeProgress = progress;
      progress.open();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      const entries: UndoEntry[] = [];
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
          const next = serializeMarkdown({ ...parsed.frontmatter, [AEGIS_KEY]: { mode: "note", envelope } satisfies AegisRecord }, LOCKED_NOTE_PLACEHOLDER);
          const reservation = await reserveProtectionUse(this);
          if (!reservation) { progress.cancelled = true; break; }
          if (await this.applyProtectionChange(file, original, next, reservation, "", false)) {
            entries.push({ path: file.path, original, resulting: next });
          }
        } catch (error) { new Notice(`Aegis skipped ${file.path}: ${error instanceof Error ? error.message : "operation failed"}`); }
      }
      progress.update(entries.length, progress.cancelled ? "Cancelled" : "Complete");
      progress.close();
      this.activeProgress = undefined;
      if (entries.length) this.undoRecord = { createdAt: Date.now(), entries };
      new Notice(`Aegis: locked ${entries.length} note(s)${progress.cancelled ? " before cancellation" : ""}.`);
    } catch (error) { this.activeProgress?.close(); this.activeProgress = undefined; notifyFailure(error); }
  }

  private async exportEncryptedBackup(file = this.currentFile()): Promise<void> {
    if (!file || !isMarkdown(file)) { new Notice("Aegis: open a Markdown note first."); return; }
    try {
      const original = await this.app.vault.read(file);
      const approved = await new ConfirmModal(this.app, "Export encrypted backup", "Aegis will write an encrypted copy into the configured vault backup folder. The backup will not contain your password.", "Choose password").waitForResult();
      if (!approved) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const envelope = await encryptText(original, password);
      const folder = this.settings.backupFolder.replace(/^\/+|\/+$/g, "") || ".aegis-backups";
      if (!(await this.app.vault.adapter.exists(folder))) await this.app.vault.adapter.mkdir(folder);
      const digest = (await sha256Hex(file.path)).slice(0, 16);
      const backupPath = `${folder}/${digest}-${Date.now()}.aegis`;
      await this.app.vault.adapter.write(backupPath, JSON.stringify({ v: 1, sourceHash: await sha256Hex(file.path), sourcePath: file.path, envelope }, null, 2));
      new Notice(`Aegis: encrypted backup written to ${backupPath}.`);
    } catch (error) { notifyFailure(error); }
  }

  private async rollbackLastOperation(): Promise<void> {
    const record = this.undoRecord;
    if (!record?.entries.length) { new Notice("Aegis: no volatile undo record is available."); return; }
    const approved = await new ConfirmModal(this.app, "Roll back last Aegis operation", `Restore ${record.entries.length} original note(s)? Aegis will refuse if any file changed since the operation.`, "Roll back").waitForResult();
    if (!approved) return;
    let restored = 0;
    const remaining: UndoEntry[] = [];
    for (const entry of record.entries) {
      const file = this.app.vault.getAbstractFileByPath(entry.path);
      if (!(file instanceof TFile)) { remaining.push(entry); continue; }
      try { await this.atomicChange(file, entry.resulting, entry.original, false); restored++; } catch { remaining.push(entry); new Notice(`Aegis: rollback refused for ${entry.path} because it changed.`); }
    }
    this.undoRecord = remaining.length ? { ...record, entries: remaining } : undefined;
    new Notice(`Aegis: rolled back ${restored} note(s)${remaining.length ? `; ${remaining.length} still available to retry` : ""}.`);
  }

  private async atomicChange(file: TFile, expected: string, next: string, recordUndo = true): Promise<void> {
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
      if (await this.app.vault.adapter.exists(tempPath)) await this.app.vault.adapter.remove(tempPath).catch(() => undefined);
      throw error;
    }
  }

  private async applyProtectionChange(file: TFile, original: string, next: string, reservation: UseReservation, successNotice: string, recordUndo = true): Promise<boolean> {
    try {
      await this.atomicChange(file, original, next, recordUndo);
      const result: ProtectionCommitResult = await reservation.commit();
      if (result.kind === "insufficient") {
        try {
          await this.atomicChange(file, next, original, false);
        } catch (rollbackError) {
          throw new Error(`Aegis could not confirm the protection charge or restore the note safely: ${rollbackError instanceof Error ? rollbackError.message : "rollback failed"}`);
        }
        new Notice("Aegis: no purchased use was available; the note was left unchanged.");
        return false;
      }
      if (successNotice) {
        new Notice(result.kind === "pending" ? `${successNotice} Billing will retry the purchased-use charge.` : successNotice);
      }
      return true;
    } catch (error) {
      await reservation.rollback();
      throw error;
    }
  }
}

import { selectedFiles, markdownFile, registerSelectionAction } from "./selection-scope";
import { diagnostics } from "./diagnostics";
import { Menu, Notice, Plugin, TFile, type Editor, type TAbstractFile } from "obsidian";
import { decryptText, encryptText, sha256Hex } from "./crypto";
import { AEGIS_KEY, displayValue, parseMarkdown, serializeMarkdown, topLevelPropertyNames } from "./frontmatter";
import { DEFAULT_SETTINGS, AegisSettingTab } from "./settings";
import { assertNoConflict, temporaryPath } from "./safety";
import { ConfirmModal, ProgressModal, notifyFailure } from "./ui";
import { jobId, recoverNative, digest } from "./native-operations";
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
  private selectionInFlight = false;

  async onload(): Promise<void> {
let diagnosticStartupEnd: () => void = () => {};

const diagnosticEnd1 = diagnostics?.start?.("main.onload") ?? (() => {});
try {

    this.support = new PluginSupport(this, { name: "Aegis Note Locker", summary: "Encrypt note bodies or selected frontmatter properties with review and rollback safeguards.", quickStart: ["Open a note.", "Run Lock current note or Lock frontmatter properties.", "Review the scope and enter a password."], commands: ["Lock current note", "Unlock current note", "Clear password session"], troubleshooting: ["Use Copy diagnostic log before reporting a problem.", "Keep the password safe; Aegis cannot recover it."] });
    this.support.start();
    await this.loadSettings();
diagnosticStartupEnd = diagnostics?.start?.("startup.initialize") ?? (() => {});

    await initializeBilling(this);
    if (this.settings.showStatusBar) this.statusBar = this.addStatusBarItem();
    this.addRibbonIcon("lock", "Aegis: Lock current note", () => diagnostics.guard("main.event_1", () => (void diagnostics.guard("main.background_2", () => (this.lockCurrentNote())))));
    this.addCommand({ id: "lock-current-note", name: "Lock current note", callback: () => this.lockCurrentNote() });
    this.addCommand({ id: "unlock-current-note", name: "Unlock current note", callback: () => this.unlockCurrentNote() });
    this.addCommand({ id: "lock-frontmatter-properties", name: "Lock selected frontmatter properties", callback: () => this.lockProperties() });
    this.addCommand({ id: "lock-all-notes", name: "Lock all Markdown notes", callback: () => this.lockAllNotes() });
    this.addCommand({ id: "cancel-lock-all", name: "Cancel active lock/unlock batch", callback: () => { if (this.activeProgress) { this.activeProgress.cancelled = true; new Notice("Aegis: cancelling the batch after the current note."); } } });
    this.addCommand({ id: "lock-now", name: "Lock now (clear session)", callback: () => this.lockNow() });
    this.addCommand({ id: "rollback-last-operation", name: "Roll back last operation", callback: () => this.rollbackLastOperation() });
    this.addCommand({ id: "export-encrypted-backup", name: "Export encrypted backup of current note", callback: () => this.exportEncryptedBackup() });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => diagnostics.guard("main.event_3", () => (this.addFileMenuItems(menu, file)))));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, info) => diagnostics.guard("main.event_4", () => (this.addEditorMenuItems(menu, editor, info?.file)))));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => diagnostics.guard("main.event_5", () => (this.updateStatusBar()))));
    this.registerInterval(window.setInterval(() => diagnostics.guard("main.timer_6", () => (this.expireSessionIfNeeded())), 30_000));
    registerSelectionAction(this, { name: "Aegis: Lock selected notes", icon: "lock", accepts: markdownFile, folders: true,
      run: files => { if (this.activeProgress) { new Notice("Aegis: a lock batch is already running."); return; } return this.lockAllNotes(files); } });
    registerSelectionAction(this, { name: "Aegis: Unlock selected notes", icon: "unlock", accepts: markdownFile, folders: true,
      run: files => this.unlockSelectedNotes(files) });
    this.addSettingTab(new AegisSettingTab(this.app, this));
    this.support.showWelcome();
    this.updateStatusBar();

} catch (diagnosticError1) { diagnostics?.failure?.("main.onload", diagnosticError1); throw diagnosticError1; } finally { diagnosticStartupEnd();  diagnostics?.legacy?.("info", "startup.finished"); diagnosticEnd1(); }
}

  onunload(): void {
return diagnostics.guard("main.onunload_7", () => {
const diagnosticAction2 = () => {
 this.lockNow();
}; return diagnostics?.run ? diagnostics.run("main.onunload", diagnosticAction2) : diagnosticAction2();

});
}

  async loadSettings(): Promise<void> {
const diagnosticEnd3 = diagnostics?.start?.("main.loadSettings") ?? (() => {});
try {

    const saved = await this.loadData() as Partial<AegisSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
    this.settings.settingsMode = this.settings.settingsMode === "advanced" ? "advanced" : "simple";
    this.settings.sessionTimeoutMinutes = Math.max(1, Math.min(120, Number(this.settings.sessionTimeoutMinutes) || 15));
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

} catch (diagnosticError3) { diagnostics?.failure?.("main.loadSettings", diagnosticError3); throw diagnosticError3; } finally { diagnosticEnd3(); }
}

  async saveSettings(): Promise<void> {
const diagnosticEnd4 = diagnostics?.start?.("main.saveSettings") ?? (() => {});
try {
 await this.saveData(this.settings);
} catch (diagnosticError4) { diagnostics?.failure?.("main.saveSettings", diagnosticError4); throw diagnosticError4; } finally { diagnosticEnd4(); }
}

  pollAfterCheckout(): void {
    let attempts = 0;
    const interval = this.registerInterval(window.setInterval(() => {
return diagnostics.guard("main.timer_8", () => {
      attempts += 1;
      void diagnostics.guard("main.background_9", () => (syncBalance(this)));
      if (attempts >= 6) window.clearInterval(interval);

});
}, 15_000));
  }

  updateStatusBar(): void {
    if (!this.settings.showStatusBar) { this.statusBar?.setText(""); return; }
    const file = this.currentFile();
    if (!file || !isMarkdown(file)) { this.statusBar?.setText("Aegis: no note"); return; }
    void diagnostics.guard("main.background_10", () => (this.app.vault.read(file).then((content) => {
      const record = asRecord(parseMarkdown(content).frontmatter[AEGIS_KEY]);
      this.statusBar?.setText(record?.mode === "note" ? "Aegis: body locked" : record?.mode === "properties" ? "Aegis: properties protected" : "Aegis: unlocked");
    }).catch((rejectedError1) => { diagnostics.failure("main.rejected_2", rejectedError1); return (this.statusBar?.setText("Aegis: unavailable")); })));
  }

  private addFileMenuItems(menu: Menu, file: TAbstractFile): void {
    if (!(file instanceof TFile) || !isMarkdown(file)) return;
    menu.addItem((item) => item.setTitle("Aegis: Lock note").setIcon("lock").onClick(() => {
return diagnostics.guard("main.control_11", () => { const diagnosticAction5 = () => (void diagnostics.guard("main.background_12", () => (this.lockCurrentNote(file)))); return diagnostics?.run ? diagnostics.run("control.7015.onClick", diagnosticAction5) : diagnosticAction5();
});
}));
    menu.addItem((item) => item.setTitle("Aegis: Unlock note").setIcon("unlock").onClick(() => {
return diagnostics.guard("main.control_13", () => { const diagnosticAction6 = () => (void diagnostics.guard("main.background_14", () => (this.unlockCurrentNote(file)))); return diagnostics?.run ? diagnostics.run("control.7145.onClick", diagnosticAction6) : diagnosticAction6();
});
}));
    menu.addItem((item) => item.setTitle("Aegis: Lock frontmatter properties").onClick(() => {
return diagnostics.guard("main.control_15", () => { const diagnosticAction7 = () => (void diagnostics.guard("main.background_16", () => (this.lockProperties(file)))); return diagnostics?.run ? diagnostics.run("control.7275.onClick", diagnosticAction7) : diagnosticAction7();
});
}));
    menu.addItem((item) => item.setTitle("Aegis: Export encrypted backup").onClick(() => {
return diagnostics.guard("main.control_17", () => { const diagnosticAction8 = () => (void diagnostics.guard("main.background_18", () => (this.exportEncryptedBackup(file)))); return diagnostics?.run ? diagnostics.run("control.7398.onClick", diagnosticAction8) : diagnosticAction8();
});
}));
  }

  private addEditorMenuItems(menu: Menu, _editor: Editor, file = this.currentFile()): void {
    menu.addItem((item) => item.setTitle("Aegis: Lock current note").setIcon("lock").onClick(() => {
return diagnostics.guard("main.control_19", () => { const diagnosticAction9 = () => (void diagnostics.guard("main.background_20", () => (this.lockCurrentNote(file)))); return diagnostics?.run ? diagnostics.run("control.7609.onClick", diagnosticAction9) : diagnosticAction9();
});
}));
    menu.addItem((item) => item.setTitle("Aegis: Unlock current note").setIcon("unlock").onClick(() => {
return diagnostics.guard("main.control_21", () => { const diagnosticAction10 = () => (void diagnostics.guard("main.background_22", () => (this.unlockCurrentNote(file)))); return diagnostics?.run ? diagnostics.run("control.7743.onClick", diagnosticAction10) : diagnosticAction10();
});
}));
  }

  private currentFile(): TFile | null { return this.app.workspace.getActiveFile(); }

  private async passwordForNewEncryption(): Promise<string | null> {
const diagnosticEnd11 = diagnostics?.start?.("main.passwordForNewEncryption") ?? (() => {});
try {

    if (this.sessionPassword && Date.now() < this.sessionExpiresAt) { this.touchSession(); return await (this.sessionPassword); }
    new Notice("Aegis: set the session password in plugin settings before running this command.");
    return null;

} catch (diagnosticError11) { diagnostics?.failure?.("main.passwordForNewEncryption", diagnosticError11); throw diagnosticError11; } finally { diagnosticEnd11(); }
}

  private async passwordForUnlock(): Promise<string | null> {
const diagnosticEnd12 = diagnostics?.start?.("main.passwordForUnlock") ?? (() => {});
try {

    if (this.sessionPassword && Date.now() < this.sessionExpiresAt) { this.touchSession(); return await (this.sessionPassword); }
    this.clearSession();
    new Notice("Aegis: set the session password in plugin settings before running this command.");
    return null;

} catch (diagnosticError12) { diagnostics?.failure?.("main.passwordForUnlock", diagnosticError12); throw diagnosticError12; } finally { diagnosticEnd12(); }
}

  setSessionPassword(password: string): void { this.sessionPassword = password || undefined; this.touchSession(); }
  private touchSession(): void { this.sessionExpiresAt = Date.now() + this.settings.sessionTimeoutMinutes * 60_000; }
  private expireSessionIfNeeded(): void { if (this.sessionPassword && Date.now() >= this.sessionExpiresAt) { this.clearSession(); new Notice("The password session expired. Enter your password again to unlock encrypted notes."); } }
  lockNow(): void { this.sessionPassword = undefined; this.sessionExpiresAt = 0; this.undoRecord = undefined; this.updateStatusBar(); }
  private clearSession(): void { this.sessionPassword = undefined; this.sessionExpiresAt = 0; this.undoRecord = undefined; }

  private protectionPreview?: {file:TFile; original:string; next:string; eventId:string; success:string};
  async retryProtectionPreview(): Promise<void> {
const diagnosticEnd13 = diagnostics?.start?.("main.retryProtectionPreview") ?? (() => {});
try {

    const preview=this.protectionPreview; if(!preview) {new Notice("No protection preview is open.");return;}
    const reservation=await reserveProtectionUse(this,preview.original,preview.next,preview.eventId);
    if(!reservation)return;
    await this.applyProtectionChange(preview.file,preview.original,preview.next,reservation,preview.success);

} catch (diagnosticError13) { diagnostics?.failure?.("main.retryProtectionPreview", diagnosticError13); throw diagnosticError13; } finally { diagnosticEnd13(); }
}
  private async lockCurrentNote(file = this.currentFile()): Promise<void> {
const diagnosticEnd14 = diagnostics?.start?.("main.lockCurrentNote") ?? (() => {});
try {

    if (!file || !isMarkdown(file)) { new Notice("Aegis: open a Markdown note first."); return; }
    try {
      const original = await this.app.vault.read(file);
      const parsed = parseMarkdown(original);
      if (asRecord(parsed.frontmatter[AEGIS_KEY])) { new Notice("Aegis: this note already has protected content."); return; }
      if (this.settings.reviewBeforeApply && !(await new ConfirmModal(this.app, "Review note lock", `The encrypted note body cannot be read by search or other plugins. Its path and frontmatter remain visible. You can restore the original during this session.`, "Continue").waitForResult())) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const envelope = await encryptText(parsed.body, password);
      const verified = await decryptText(envelope, password);
      if (verified !== parsed.body) throw new Error("Aegis verification failed before the file was changed.");
      const next = serializeMarkdown({ ...parsed.frontmatter, [AEGIS_KEY]: { mode: "note", envelope } satisfies AegisRecord }, LOCKED_NOTE_PLACEHOLDER);
      this.protectionPreview={file,original,next,eventId:jobId(),success:"Aegis: note locked."};
      if(!this.settings.billingAccessToken) {new Notice("Your note is ready to encrypt. Keep this session open, sign in and verify your email in Settings, then choose Resume protection. Nothing has been saved.");return;}
      await this.retryProtectionPreview();
    } catch (error) {
diagnostics.failure("main.caught_23", error); notifyFailure(error); }

} catch (diagnosticError14) { diagnostics?.failure?.("main.lockCurrentNote", diagnosticError14); throw diagnosticError14; } finally { diagnosticEnd14(); }
}

  private async lockProperties(file = this.currentFile()): Promise<void> {
const diagnosticEnd15 = diagnostics?.start?.("main.lockProperties") ?? (() => {});
try {

    if (!file || !isMarkdown(file)) { new Notice("Aegis: open a Markdown note first."); return; }
    try {
      const original = await this.app.vault.read(file);
      const parsed = parseMarkdown(original);
      if (asRecord(parsed.frontmatter[AEGIS_KEY])?.mode === "note") { new Notice("Aegis: unlock the note body before protecting properties."); return; }
      const existing = asRecord(parsed.frontmatter[AEGIS_KEY]);
      const keys = topLevelPropertyNames(parsed.frontmatter).filter((key) => !existing?.properties?.[key]);
      if (!keys.length) { new Notice("Aegis: this note has no top-level frontmatter properties."); return; }
      const configured = this.settings.protectedProperties.split(/[\n,]/).map((key) => key.trim()).filter(Boolean);
      const chosen = configured.length ? keys.filter((key) => configured.includes(key)) : keys;
      if (!chosen.length) { new Notice("Aegis: none of the configured frontmatter properties exist in this note."); return; }
      if (this.settings.reviewBeforeApply && !(await new ConfirmModal(this.app, "Review property lock", `Protect ${chosen.length} frontmatter propert${chosen.length === 1 ? "y" : "ies"}? Names stay visible; values will be replaced with a non-sensitive placeholder.`, "Continue").waitForResult())) return;
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
      this.protectionPreview={file,original,next,eventId:jobId(),success:`Aegis: protected ${chosen.length} properties.`};
      if(!this.settings.billingAccessToken) {new Notice("Your selected properties are ready to encrypt. Keep this session open, sign in and verify your email in Settings, then choose Resume protection. Nothing has been saved.");return;}
      await this.retryProtectionPreview();
    } catch (error) {
diagnostics.failure("main.caught_24", error); notifyFailure(error); }

} catch (diagnosticError15) { diagnostics?.failure?.("main.lockProperties", diagnosticError15); throw diagnosticError15; } finally { diagnosticEnd15(); }
}

  private async unlockCurrentNote(file = this.currentFile(), batch?: { password: string }): Promise<UndoEntry | null> {
const diagnosticEnd16 = diagnostics?.start?.("main.unlockCurrentNote") ?? (() => {});
try {

    if (!batch && this.selectionInFlight) { new Notice("Aegis: a note batch is already running."); return null; }
    if (!file || !isMarkdown(file)) { new Notice("Aegis: open a Markdown note first."); return null; }
    try {
      const original = await this.app.vault.read(file);
      const parsed = parseMarkdown(original);
      const record = asRecord(parsed.frontmatter[AEGIS_KEY]);
      if (!record) { new Notice("Aegis: this note is not locked."); return null; }
      if (!batch && this.settings.reviewBeforeApply && !(await new ConfirmModal(this.app, "Review unlock", "The encrypted record will be verified before the note is replaced. Nothing changes if the password is wrong or the file changed on disk.", "Continue").waitForResult())) return null;
      const password = batch?.password ?? await this.passwordForUnlock();
      if (!password) return null;
      const nextFrontmatter = { ...parsed.frontmatter };
      delete nextFrontmatter[AEGIS_KEY];
      let nextBody = parsed.body;
      if (record.mode === "note" && record.envelope) {
        nextBody = await decryptText(record.envelope, password);
      } else if (record.mode === "properties" && record.properties) {
        for (const [key, envelope] of Object.entries(record.properties)) nextFrontmatter[key] = JSON.parse(await decryptText(envelope, password));
      } else throw new Error("Unsupported Aegis record.");
      const next = serializeMarkdown(nextFrontmatter, nextBody);
      await this.atomicChange(file, original, next, !batch);
      if (!batch) new Notice("Aegis: note unlocked.");
      return { path: file.path, original, resulting: next };
    } catch (error) {
diagnostics.failure("main.caught_25", error); notifyFailure(error); return null; }

} catch (diagnosticError16) { diagnostics?.failure?.("main.unlockCurrentNote", diagnosticError16); throw diagnosticError16; } finally { diagnosticEnd16(); }
}

  private async unlockSelectedNotes(files: TFile[]): Promise<void> {
    if (this.selectionInFlight || this.activeProgress) { new Notice("Aegis: a note batch is already running."); return; }
    this.selectionInFlight = true;
    const entries: UndoEntry[] = [];
    let failed = 0, skipped = 0;
    let progress: ProgressModal | undefined;
    try {
      const candidates: TFile[] = [];
      for (const file of files) {
        try { if (asRecord(parseMarkdown(await this.app.vault.read(file)).frontmatter[AEGIS_KEY])) candidates.push(file); else skipped++; }
        catch { failed++; }
      }
      if (!candidates.length) { new Notice(`Aegis: no locked selected notes; ${skipped} skipped, ${failed} failed.`); return; }
      if (this.settings.reviewBeforeApply && !(await new ConfirmModal(this.app, "Review selected-note unlock", `${candidates.length} locked notes will be decrypted. Unlocked notes are skipped; all successful changes can be rolled back together.`, "Continue").waitForResult())) return;
      const password = await this.passwordForUnlock();
      if (!password) return;
      progress = new ProgressModal(this.app, candidates.length);
      this.activeProgress = progress;
      if (this.support.automaticWindowsEnabled()) progress.open();
      for (let index = 0; index < candidates.length; index++) {
        if (progress.cancelled) break;
        progress.update(index, candidates[index].path);
        const entry = await this.unlockCurrentNote(candidates[index], { password });
        if (entry) entries.push(entry); else failed++;
      }
      new Notice(`Aegis: unlocked ${entries.length} note(s), ${skipped} skipped, ${failed} failed${progress.cancelled ? "; cancelled before the remaining notes" : ""}.`);
    } catch (error) { notifyFailure(error); }
    finally {
      if (entries.length) this.undoRecord = { createdAt: Date.now(), entries };
      progress?.close();
      this.activeProgress = undefined;
      this.selectionInFlight = false;
    }
  }
  private async lockAllNotes(selected?: TFile[]): Promise<void> {
const diagnosticEnd17 = diagnostics?.start?.("main.lockAllNotes") ?? (() => {});
if (this.selectionInFlight || this.activeProgress) { diagnosticEnd17(); new Notice("Aegis: a note batch is already running."); return; }
this.selectionInFlight = true;
try {

    try {
      const files = selected ?? this.app.vault.getMarkdownFiles();
      const candidates: TFile[] = [];
      for (const file of files) { const content = await this.app.vault.read(file); if (!asRecord(parseMarkdown(content).frontmatter[AEGIS_KEY])) candidates.push(file); }
      if (!candidates.length) { new Notice("Aegis: no unlocked Markdown notes found."); return; }
      if (this.settings.reviewBeforeApply && !(await new ConfirmModal(this.app, "Review lock-all operation", `${candidates.length} Markdown notes will be encrypted. Each file is checked for sync conflicts and verified before replacement.`, "Continue").waitForResult())) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const progress = new ProgressModal(this.app, candidates.length);
      this.activeProgress = progress;
      if (this.support.automaticWindowsEnabled()) progress.open();
      else new Notice("Aegis: locking notes.");
      await new Promise<void>((resolve) => window.setTimeout(diagnostics.wrap("main.timer_26", resolve), 0));
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
          const reservation = await reserveProtectionUse(this,original,next);
          if (!reservation) { progress.cancelled = true; break; }
          if (await this.applyProtectionChange(file, original, next, reservation, "", false)) {
            entries.push({ path: file.path, original, resulting: next });
          }
        } catch (error) {
diagnostics.failure("main.caught_27", error); new Notice(`Aegis skipped ${file.path}: ${error instanceof Error ? error.message : "operation failed"}`); }
      }
      progress.update(entries.length, progress.cancelled ? "Cancelled" : "Complete");
      progress.close();
      this.activeProgress = undefined;
      if (entries.length) this.undoRecord = { createdAt: Date.now(), entries };
      new Notice(`Aegis: locked ${entries.length} note(s)${progress.cancelled ? " before cancellation" : ""}.`);
    } catch (error) {
diagnostics.failure("main.caught_28", error); this.activeProgress?.close(); this.activeProgress = undefined; notifyFailure(error); }

} catch (diagnosticError17) { diagnostics?.failure?.("main.lockAllNotes", diagnosticError17); throw diagnosticError17; } finally { this.selectionInFlight = false; diagnosticEnd17(); }
}

  private async exportEncryptedBackup(file = this.currentFile()): Promise<void> {
const diagnosticEnd18 = diagnostics?.start?.("main.exportEncryptedBackup") ?? (() => {});
try {

    if (!file || !isMarkdown(file)) { new Notice("Aegis: open a Markdown note first."); return; }
    try {
      const original = await this.app.vault.read(file);
      if (this.settings.reviewBeforeApply && !(await new ConfirmModal(this.app, "Export encrypted backup", "Aegis will write an encrypted copy into the configured vault backup folder. The backup will not contain your password.", "Continue").waitForResult())) return;
      const password = await this.passwordForNewEncryption();
      if (!password) return;
      const envelope = await encryptText(original, password);
      const backupResult=JSON.stringify({v:1,sourceHash:await sha256Hex(file.path),sourcePath:file.path,envelope},null,2);
      const newProtection=!asRecord(parseMarkdown(original).frontmatter[AEGIS_KEY]);
      const reservation=newProtection ? await reserveProtectionUse(this,original,backupResult) : null;
      if(newProtection && !reservation)return;

      const folder = this.settings.backupFolder.replace(/^\/+|\/+$/g, "") || ".aegis-backups";
      if (!(await this.app.vault.adapter.exists(folder))) await this.app.vault.adapter.mkdir(folder);
      const pathDigest = (await sha256Hex(file.path)).slice(0, 16);
      const backupPath = `${folder}/${pathDigest}-${Date.now()}.aegis`;
      if(reservation?.markWriting && !await reservation.markWriting([{path:backupPath,after:await digest(backupResult)}]))return;
      await this.app.vault.adapter.write(backupPath, backupResult);
      if(await this.app.vault.adapter.read(backupPath)!==backupResult)throw new Error("The backup could not be confirmed. Check the backup folder before retrying. Its credits are still reserved.");
      const committed=await reservation?.commit();
      if(committed?.kind==="pending")new Notice("Encrypted backup saved. Its charge is awaiting confirmation.");
      new Notice(`Aegis: encrypted backup written to ${backupPath}.`);
    } catch (error) {
diagnostics.failure("main.caught_29", error); notifyFailure(error); }

} catch (diagnosticError18) { diagnostics?.failure?.("main.exportEncryptedBackup", diagnosticError18); throw diagnosticError18; } finally { diagnosticEnd18(); }
}

  private async rollbackLastOperation(): Promise<void> {
const diagnosticEnd19 = diagnostics?.start?.("main.rollbackLastOperation") ?? (() => {});
try {

    const record = this.undoRecord;
    if (!record?.entries.length) { new Notice("Aegis: no changes are available to restore in this session."); return; }
    if (this.settings.reviewBeforeApply && !(await new ConfirmModal(this.app, "Roll back last Aegis operation", `Restore ${record.entries.length} original note(s)? Aegis will refuse if any file changed since the operation.`, "Roll back").waitForResult())) return;
    let restored = 0;
    const remaining: UndoEntry[] = [];
    for (const entry of record.entries) {
      const file = this.app.vault.getAbstractFileByPath(entry.path);
      if (!(file instanceof TFile)) { remaining.push(entry); continue; }
      try { await this.atomicChange(file, entry.resulting, entry.original, false); restored++; } catch (caughtError30) {
diagnostics.failure("main.caught_31", caughtError30); remaining.push(entry); new Notice(`Aegis: rollback refused for ${entry.path} because it changed.`); }
    }
    this.undoRecord = remaining.length ? { ...record, entries: remaining } : undefined;
    new Notice(`Aegis: rolled back ${restored} note(s)${remaining.length ? `; ${remaining.length} still available to retry` : ""}.`);

} catch (diagnosticError19) { diagnostics?.failure?.("main.rollbackLastOperation", diagnosticError19); throw diagnosticError19; } finally { diagnosticEnd19(); }
}

  private async atomicChange(file: TFile, expected: string, next: string, recordUndo = true): Promise<void> {
const diagnosticEnd20 = diagnostics?.start?.("main.atomicChange") ?? (() => {});
try {

    const current = await this.app.vault.read(file);
    assertNoConflict(expected, current);
    const tempPath = temporaryPath(file.path);
    try {
      await this.app.vault.adapter.write(tempPath, next);
      const staged = await this.app.vault.adapter.read(tempPath);
      if (staged !== next) throw new Error("Staged file verification failed.");
      await this.app.vault.process(file,latest=>{assertNoConflict(expected,latest);return staged;});
      await this.app.vault.adapter.remove(tempPath);
      const committed = await this.app.vault.read(file);
      if (committed !== next) throw new Error("Committed file verification failed.");
      if (recordUndo) this.undoRecord = { createdAt: Date.now(), entries: [{ path: file.path, original: expected, resulting: next }] };
    } catch (error) {
diagnostics.failure("main.caught_32", error);
      if (await this.app.vault.adapter.exists(tempPath)) await this.app.vault.adapter.remove(tempPath).catch((rejectedError3) => { diagnostics.failure("main.rejected_4", rejectedError3); return (undefined); });
      throw error;
    }

} catch (diagnosticError20) { diagnostics?.failure?.("main.atomicChange", diagnosticError20); throw diagnosticError20; } finally { diagnosticEnd20(); }
}

  private async applyProtectionChange(file: TFile, original: string, next: string, reservation: UseReservation, successNotice: string, recordUndo = true): Promise<boolean> {
const diagnosticEnd21 = diagnostics?.start?.("main.applyProtectionChange") ?? (() => {});
try {

    try {
      if(reservation.markWriting && !await reservation.markWriting([{path:file.path,before:await digest(original),after:await digest(next)}]))return true;
      await this.atomicChange(file, original, next, recordUndo);
      const result: ProtectionCommitResult = await reservation.commit();
      if (result.kind === "insufficient") {
        try {
          await this.atomicChange(file, next, original, false);
        } catch (rollbackError) {
diagnostics.failure("main.caught_33", rollbackError);
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
diagnostics.failure("main.caught_34", error);
      await reservation.rollback();
      throw error;
    }

} catch (diagnosticError21) { diagnostics?.failure?.("main.applyProtectionChange", diagnosticError21); throw diagnosticError21; } finally { diagnosticEnd21(); }
}
}

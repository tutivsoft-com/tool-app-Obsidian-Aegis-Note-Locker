import { diagnostics } from "./diagnostics";
import { renderNativePacks } from "./native-operations";
import { App, Notice, PluginSettingTab, Setting, type TextComponent } from "obsidian";
import type AegisNoteLockerPlugin from "./main";
import { openCheckout, retryPendingProtectionCharges, syncBalance } from "./billing";
import { remainingFreeUses } from "./usage";
import { addBillingAccountSettings } from "./constance-account";
export { DEFAULT_SETTINGS } from "./types";

export class AegisSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: AegisNoteLockerPlugin) { super(app, plugin); }

  display(): void {
return diagnostics.guard("settings.display_1", () => {
const diagnosticAction1 = () => {

    const { containerEl } = this;
    const diagnosticStage2 = diagnostics?.start?.("settings.render.clear") ?? (() => {});
containerEl.empty();
diagnosticStage2();

    const diagnosticStage3 = diagnostics?.start?.("settings.render.help") ?? (() => {});
this.plugin.support.addHelpSetting(containerEl);
diagnosticStage3();

this.plugin.support.addDebugSetting?.(containerEl);


    const diagnosticStage4 = diagnostics?.start?.("settings.render.stage_1") ?? (() => {});
containerEl.createEl("h2", { text: "Aegis Note Locker" });
diagnosticStage4();

    const advanced = this.plugin.settings.settingsMode === "advanced";
    const diagnosticStage5 = diagnostics?.start?.("settings.render.settings_mode") ?? (() => {});
new Setting(containerEl).setName("Settings mode").setDesc("Simple shows everyday controls. Advanced includes detailed behavior and troubleshooting.").addDropdown((dropdown) => dropdown.addOption("simple", "Simple").addOption("advanced", "Advanced — optional").setValue(this.plugin.settings.settingsMode).onChange(async (value) => {
return diagnostics.guard("settings.control_2", async () => {
const diagnosticEnd19 = diagnostics?.start?.("control.settings_mode.onChange") ?? (() => {});
try {
 this.plugin.settings.settingsMode = value === "advanced" ? "advanced" : "simple"; await this.plugin.saveSettings(); this.display();
} catch (diagnosticError19) { diagnostics?.failure?.("control.settings_mode.onChange", diagnosticError19); throw diagnosticError19; } finally { diagnosticEnd19(); }

});
}));
diagnosticStage5();

    let sessionPassword = "";
    let passwordInput: TextComponent | undefined;
    const diagnosticStage6 = diagnostics?.start?.("settings.render.session_password") ?? (() => {});
new Setting(containerEl).setName("Session password").setDesc("Set this once per Obsidian session so Lock, Unlock, and Backup run without password pop-ups. The password stays in memory only and is never saved to plugin data.").addText((text) => { passwordInput = text; text.setPlaceholder("Session password"); text.inputEl.type = "password"; text.onChange((value) => {
return diagnostics.guard("settings.control_3", () => { const diagnosticAction20 = () => (sessionPassword = value); return diagnostics?.run ? diagnostics.run("control.1766.onChange", diagnosticAction20) : diagnosticAction20();
});
}); }).addButton((button) => button.setButtonText("Set for session").setCta().onClick(() => {
return diagnostics.guard("settings.control_4", () => {
const diagnosticAction21 = () => {
 if (!sessionPassword) { new Notice("Enter a password to set it for this session."); passwordInput?.inputEl.focus(); return; } this.plugin.setSessionPassword(sessionPassword); sessionPassword = ""; passwordInput?.setValue(""); new Notice("Aegis session password set.");
}; return diagnostics?.run ? diagnostics.run("control.session_password.onClick", diagnosticAction21) : diagnosticAction21();

});
}));
diagnosticStage6();

    const diagnosticStage7 = diagnostics?.start?.("settings.render.review_before_applying") ?? (() => {});
new Setting(containerEl).setName("Review before applying").setDesc("Review and confirm changes before applying them. Off by default.").addToggle((toggle) => toggle.setValue(this.plugin.settings.reviewBeforeApply).onChange(async (value) => {
return diagnostics.guard("settings.control_5", async () => {
const diagnosticEnd22 = diagnostics?.start?.("control.review_before_applying.onChange") ?? (() => {});
try {
 this.plugin.settings.reviewBeforeApply = value; await this.plugin.saveSettings();
} catch (diagnosticError22) { diagnostics?.failure?.("control.review_before_applying.onChange", diagnosticError22); throw diagnosticError22; } finally { diagnosticEnd22(); }

});
}));
diagnosticStage7();

    const diagnosticStage8 = diagnostics?.start?.("settings.render.protected_properties") ?? (() => {});
if (advanced) {
    new Setting(containerEl).setName("Protected properties").setDesc("Comma or newline separated frontmatter property names to protect. Leave empty to protect every eligible property.").addTextArea((text) => text.setValue(this.plugin.settings.protectedProperties).onChange(async (value) => {
return diagnostics.guard("settings.control_6", async () => {
const diagnosticEnd23 = diagnostics?.start?.("control.protected_properties.onChange") ?? (() => {});
try {
 this.plugin.settings.protectedProperties = value; await this.plugin.saveSettings();
} catch (diagnosticError23) { diagnostics?.failure?.("control.protected_properties.onChange", diagnosticError23); throw diagnosticError23; } finally { diagnosticEnd23(); }

});
}));
    }
diagnosticStage8();

    const diagnosticStage9 = diagnostics?.start?.("settings.render.stage_2") ?? (() => {});
containerEl.createEl("p", { text: "Encryption happens on your device. Passwords and protected content are never uploaded. Account and purchase requests use the account service." });
diagnosticStage9();

    const diagnosticStage10 = diagnostics?.start?.("settings.render.billing") ?? (() => {});
new Setting(containerEl).setName("Billing").setHeading();
diagnosticStage10();

    const balanceEl = containerEl.createEl("p", { cls: "aegis-billing-summary" });
    const renderBalance = (): void => {
const diagnosticAction24 = () => {

      const pending = this.plugin.settings.pendingProtectionCharges?.length ?? 0;
      balanceEl.setText(!this.plugin.settings.billingAccountLinked || !this.plugin.settings.billingAccessToken ? "Create an account or sign in, then Connect to load your free and purchased credits." : `Protection uses remaining: ${remainingFreeUses(this.plugin.settings)} free (last updated balance) + ${this.plugin.settings.purchasedUses.toLocaleString()} purchased${pending ? ` (${pending} charge pending)` : ""}`);

}; return diagnostics?.run ? diagnostics.run("settings.renderBalance", diagnosticAction24) : diagnosticAction24();
};
    const diagnosticStage11 = diagnostics?.start?.("settings.render.stage_3") ?? (() => {});
renderBalance();
diagnosticStage11();

    const diagnosticStage12 = diagnostics?.start?.("settings.render.account") ?? (() => {});
addBillingAccountSettings(containerEl, { state: this.plugin.settings, appId: "aegis-note-locker", installationId: this.plugin.settings.constanceDeviceId, appVersion: this.plugin.manifest.version, persist: () => this.plugin.saveSettings(), syncBalance: () => syncBalance(this.plugin), refresh: () => this.display() });
diagnosticStage12();

    const diagnosticStage13 = diagnostics?.start?.("settings.render.retry_preserved_protection") ?? (() => {});
new Setting(containerEl).setName("Resume protection").setDesc("Continue with the preview saved in this session. Notes that changed since the preview will not be overwritten.").addButton(b=>b.setButtonText("Retry").onClick(()=>{
return diagnostics.guard("settings.control_7", () => { const diagnosticAction25 = () => (void diagnostics.guard("settings.background_8", () => (this.plugin.retryProtectionPreview()))); return diagnostics?.run ? diagnostics.run("control.retry_preserved_protection.onClick", diagnosticAction25) : diagnosticAction25();
});
}));
diagnosticStage13();

    const diagnosticStage14 = diagnostics?.start?.("settings.render.catalog") ?? (() => {});
void diagnostics.guard("settings.background_9", () => (renderNativePacks(containerEl,{app:this.app,settings:this.plugin.settings,persistNative:()=>this.plugin.saveSettings()},"aegis-note-locker",async plan=>{
const diagnosticEnd26 = diagnostics?.start?.("settings.background.4643") ?? (() => {});
try {
const {openAccountCheckoutByPrice}=await import("./billing-checkout");await openAccountCheckoutByPrice({state:this.plugin.settings,appId:"aegis-note-locker",installationId:this.plugin.settings.constanceDeviceId,persist:()=>this.plugin.saveSettings(),syncBalance:()=>syncBalance(this.plugin),refreshSession:async()=>{
const diagnosticEnd27 = diagnostics?.start?.("settings.background.4962") ?? (() => {});
try {
const a=await import("./constance-account");return await (a.refreshBillingSession(this.plugin.settings,()=>this.plugin.saveSettings()));
} catch (diagnosticError27) { diagnostics?.failure?.("settings.background.4962", diagnosticError27); throw diagnosticError27; } finally { diagnosticEnd27(); }
}},plan);
} catch (diagnosticError26) { diagnostics?.failure?.("settings.background.4643", diagnosticError26); throw diagnosticError26; } finally { diagnosticEnd26(); }
})));
diagnosticStage14();

    const diagnosticStage15 = diagnostics?.start?.("settings.render.refresh_purchased_balance") ?? (() => {});
new Setting(containerEl)
      .setName("Refresh balance")
      .setDesc("Update your free and purchased credit balance. Unlocking, viewing, restoring, and exporting already protected content are free.")
      .addButton((button) => button.setButtonText("Refresh").onClick(async () => {
return diagnostics.guard("settings.control_10", async () => {
const diagnosticEnd28 = diagnostics?.start?.("control.refresh_purchased_balance.onClick") ?? (() => {});
try {

        button.setDisabled(true);
        try {
          await syncBalance(this.plugin, true);
          await retryPendingProtectionCharges(this.plugin);
          renderBalance();
        } catch (caughtError11) {
diagnostics.failure("settings.caught_12", caughtError11);
          new Notice("Aegis: balance could not be refreshed. Check your connection and account, then retry.");
        } finally {
          button.setDisabled(false);
        }

} catch (diagnosticError28) { diagnostics?.failure?.("control.refresh_purchased_balance.onClick", diagnosticError28); throw diagnosticError28; } finally { diagnosticEnd28(); }

});
}));
diagnosticStage15();

    const diagnosticStage16 = diagnostics?.start?.("settings.render.stage_4") ?? (() => {});
void diagnostics.guard("settings.background_13", () => (syncBalance(this.plugin).then(() => retryPendingProtectionCharges(this.plugin)).then(renderBalance).catch((rejectedError1) => {
diagnostics.failure("settings.rejected_2", rejectedError1); balanceEl.setText("Balance unavailable. Use Refresh to retry; your saved balance is retained."); })));
diagnosticStage16();

    const diagnosticStage17 = diagnostics?.start?.("settings.render.session_timeout") ?? (() => {});
new Setting(containerEl)
      .setName("Session timeout")
      .setDesc("Minutes of inactivity before the password is cleared. Default: 15 minutes; enter it again to unlock later.")
      .addDropdown((dropdown) => dropdown.addOption("5", "5 minutes — shorter sessions").addOption("15", "15 minutes — recommended").addOption("30", "30 minutes").addOption("60", "60 minutes").addOptions([5, 15, 30, 60].includes(this.plugin.settings.sessionTimeoutMinutes) ? {} : { [String(this.plugin.settings.sessionTimeoutMinutes)]: `${this.plugin.settings.sessionTimeoutMinutes} minutes — current` }).setValue(String(this.plugin.settings.sessionTimeoutMinutes)).onChange(async (value) => {
return diagnostics.guard("settings.control_14", async () => {
const diagnosticEnd29 = diagnostics?.start?.("control.session_timeout.onChange") ?? (() => {});
try {

        this.plugin.settings.sessionTimeoutMinutes = Number(value);
        await this.plugin.saveSettings();

} catch (diagnosticError29) { diagnostics?.failure?.("control.session_timeout.onChange", diagnosticError29); throw diagnosticError29; } finally { diagnosticEnd29(); }

});
}));
diagnosticStage17();

    const diagnosticStage18 = diagnostics?.start?.("settings.render.encrypted_backup_folder") ?? (() => {});
if (advanced) {
    this.plugin.support.addDiagnosticsSetting(containerEl);
    new Setting(containerEl)
      .setName("Encrypted backup folder")
      .setDesc("Vault-relative folder used for user-requested encrypted exports.")
      .addText((text) => text.setPlaceholder(".aegis-backups").setValue(this.plugin.settings.backupFolder).onChange(async (value) => {
return diagnostics.guard("settings.control_15", async () => {
const diagnosticEnd30 = diagnostics?.start?.("control.encrypted_backup_folder.onChange") ?? (() => {});
try {

        this.plugin.settings.backupFolder = value.trim() || ".aegis-backups";
        await this.plugin.saveSettings();

} catch (diagnosticError30) { diagnostics?.failure?.("control.encrypted_backup_folder.onChange", diagnosticError30); throw diagnosticError30; } finally { diagnosticEnd30(); }

});
}));
    new Setting(containerEl)
      .setName("Show status bar")
      .setDesc("Show the current note's locked or unlocked state in the status bar.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
return diagnostics.guard("settings.control_16", async () => {
const diagnosticEnd31 = diagnostics?.start?.("control.show_status_bar.onChange") ?? (() => {});
try {

        this.plugin.settings.showStatusBar = value;
        await this.plugin.saveSettings();
        this.plugin.updateStatusBar();

} catch (diagnosticError31) { diagnostics?.failure?.("control.show_status_bar.onChange", diagnosticError31); throw diagnosticError31; } finally { diagnosticEnd31(); }

});
}));
    containerEl.createEl("h3", { text: "Recovery" });
    containerEl.createEl("p", { text: "Use Export encrypted backup before moving notes or changing sync settings. You can restore the latest action during the current plugin session." });
    }
diagnosticStage18();


}; return diagnostics?.run ? diagnostics.run("settings.open", diagnosticAction1) : diagnosticAction1();

});
}

  hide(): void { const end = diagnostics?.start?.("settings.close") ?? (() => {}); try { super.hide(); } finally { end(); } }
}

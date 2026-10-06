import { diagnostics } from "./diagnostics";
import { registerBillingPersister } from "./constance-account";
import { reserveNative, jobId, codePoints, recoverNative } from "./native-operations";
import { resumeAccountCheckout } from "./billing-checkout";
import { openAccountCheckout } from "./billing-checkout";
import { refreshBillingSession } from "./constance-account";
import { Notice } from "obsidian";
import type AegisNoteLockerPlugin from "./main";
import { consumeFreeUse, refundFreeUse, resetDailyUsageIfNeeded, localDayKey } from "./usage";
import { claimAccountFreeUsage, requestAuthenticatedBilling, spendAccountCredits } from "./constance-account";

const BASE_URL = "https://app.tutivsoft.com";
export const AEGIS_APP_ID = "aegis-note-locker";

export type AegisPackKey = "usd_001" | "usd_010";

// Legacy plan names remain for recovery of previously saved checkout records.
export const AEGIS_PLAN_CODES: Record<AegisPackKey, string> = {
  usd_001: "one_time",
  usd_010: "standard",
};

export type SpendResult =
  | { kind: "ok"; balance: number }
  | { kind: "insufficient" }
  | { kind: "error" };

export type ProtectionCommitResult =
  | { kind: "committed" }
  | { kind: "pending" }
  | { kind: "insufficient" };

export interface UseReservation {
  source: "free" | "purchased";
  markWriting?(evidence?:import("./native-operations").WriteEvidence[]): Promise<boolean>;
  commit: () => Promise<ProtectionCommitResult>;
  rollback: () => Promise<void>;
}

function generateEventId(): string {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  return `evt_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function ensureDeviceId(plugin: AegisNoteLockerPlugin): string {
  if (!plugin.settings.constanceDeviceId) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    plugin.settings.constanceDeviceId = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return plugin.settings.constanceDeviceId;
}

async function saveBillingState(plugin: AegisNoteLockerPlugin): Promise<boolean> {
const diagnosticEnd1 = diagnostics?.start?.("billing.saveBillingState") ?? (() => {});
try {

  try {
    await plugin.saveSettings();
    return true;
  } catch (error) {
diagnostics.failure("billing.caught_extra_1", error);
    diagnostics?.legacy?.("warn", "billing.aegis_billing_state_save_failed");
    return false;
  }

} catch (diagnosticError1) { diagnostics?.failure?.("billing.saveBillingState", diagnosticError1); throw diagnosticError1; } finally { diagnosticEnd1(); }
}

async function fetchBalance(plugin: AegisNoteLockerPlugin): Promise<number> {
const diagnosticEnd2 = diagnostics?.start?.("billing.fetchBalance") ?? (() => {});
try {

  const response = await requestAuthenticatedBilling(plugin.settings, {
    url: `${BASE_URL}/api/v1/billing/entitlements/me?${new URLSearchParams({ app_id: AEGIS_APP_ID, installation_id: plugin.settings.constanceDeviceId }).toString()}`,
    method: "GET",
  });
  if (response.status === 401 || response.status === 403 || response.status === 404) { plugin.settings.billingAccessToken = ""; plugin.settings.billingRefreshToken = ""; plugin.settings.billingAccountLinked = false; await saveBillingState(plugin); throw new Error("Billing session expired"); }
  if (response.status < 200 || response.status >= 300) throw new Error(`Your account could not be updated. Check your connection and try again.`);
  const paid = response.json?.data?.credits?.total_available ?? response.json?.data?.credits?.balance;
  if (paid === undefined || paid === null || String(paid).trim() === "" || !Number.isFinite(Number(paid)) || Number(paid) < 0) throw new Error("Your balance could not be updated. Refresh it and try again.");
  if (!response.json?.data?.free_usage) throw new Error("Your balance could not be updated. Refresh it and try again.");
  if (response.json?.data?.free_usage) {
    const remaining = response.json.data.free_usage.remaining;
    if (!Number.isFinite(remaining) || remaining < 0) throw new Error("Your balance could not be updated. Refresh it and try again.");
    plugin.settings.freeUsesDay = localDayKey();
    plugin.settings.freeUsesUsed = Math.max(0, 5 - Number(remaining));
  }
  return Number(paid);

} catch (diagnosticError2) { diagnostics?.failure?.("billing.fetchBalance", diagnosticError2); throw diagnosticError2; } finally { diagnosticEnd2(); }
}

export async function syncBalance(plugin: AegisNoteLockerPlugin, strict = false): Promise<void> {
const diagnosticEnd3 = diagnostics?.start?.("billing.syncBalance") ?? (() => {});
try {

  registerBillingPersister(plugin.settings, () => plugin.saveSettings());
  resumeAccountCheckout({ state: plugin.settings, appId: AEGIS_APP_ID, installationId: plugin.settings.constanceDeviceId,
    persist: () => plugin.saveSettings(), syncBalance: () => syncBalance(plugin), refreshSession: () => refreshBillingSession(plugin.settings, () => plugin.saveSettings()) });

  const deviceId = ensureDeviceId(plugin);
  try {
    if (!plugin.settings.billingAccessToken || !plugin.settings.billingAccountLinked) { if (strict) throw new Error("Connect your account before refreshing."); return; }
    plugin.settings.purchasedUses = await fetchBalance(plugin);
    await saveBillingState(plugin);
  } catch (error) {
diagnostics.failure("billing.caught_extra_2", error);
    diagnostics?.legacy?.("warn", "billing.aegis_constance_balance_sync_failed");
      if (strict) throw error;
  }

} catch (diagnosticError3) { diagnostics?.failure?.("billing.syncBalance", diagnosticError3); throw diagnosticError3; } finally { diagnosticEnd3(); }
}

async function spendPurchasedUse(plugin: AegisNoteLockerPlugin, eventId: string): Promise<SpendResult> {
const diagnosticEnd4 = diagnostics?.start?.("billing.spendPurchasedUse") ?? (() => {});
try {

  try {
    const result = await spendAccountCredits(plugin.settings, AEGIS_APP_ID, plugin.settings.constanceDeviceId, eventId, 1);
    if (result.kind === "auth-required") { plugin.settings.billingAccessToken = ""; plugin.settings.billingRefreshToken = ""; plugin.settings.billingAccountLinked = false; await saveBillingState(plugin); return { kind: "error" }; }
    if (result.kind === "insufficient" || result.kind === "error") return await (result);
    return { kind: "ok", balance: Math.max(0, result.balance) };
  } catch (error) {
diagnostics.failure("billing.caught_extra_3", error);
    diagnostics?.legacy?.("warn", "billing.aegis_constance_credit_spend_call_failed");
    return { kind: "error" };
  }

} catch (diagnosticError4) { diagnostics?.failure?.("billing.spendPurchasedUse", diagnosticError4); throw diagnosticError4; } finally { diagnosticEnd4(); }
}

/** Retry persisted charges with their original event IDs after an uncertain request. */
export async function retryPendingProtectionCharges(plugin: AegisNoteLockerPlugin): Promise<void> {
const diagnosticEnd5 = diagnostics?.start?.("billing.retryPendingProtectionCharges") ?? (() => {});
try {

  const pending = [...(plugin.settings.pendingProtectionCharges ?? [])];
  if (!pending.length) return;
  const deviceId = ensureDeviceId(plugin);
  for (const eventId of pending) {
    const result = await spendPurchasedUse(plugin, eventId);
    if (result.kind === "error") break;
    if (result.kind === "insufficient") {
      plugin.settings.purchasedUses = 0;
      // The server has authoritatively rejected this event. Keeping it in
      // the pending queue would block every future paid operation forever.
      plugin.settings.pendingProtectionCharges = plugin.settings.pendingProtectionCharges.filter((id) => id !== eventId);
      await saveBillingState(plugin);
      break;
    }
    plugin.settings.purchasedUses = result.balance;
    plugin.settings.pendingProtectionCharges = plugin.settings.pendingProtectionCharges.filter((id) => id !== eventId);
    if (!(await saveBillingState(plugin))) break;
  }

} catch (diagnosticError5) { diagnostics?.failure?.("billing.retryPendingProtectionCharges", diagnosticError5); throw diagnosticError5; } finally { diagnosticEnd5(); }
}

export async function initializeBilling(plugin: AegisNoteLockerPlugin): Promise<void> {
const diagnosticEnd6 = diagnostics?.start?.("billing.initializeBilling") ?? (() => {});
try {

  ensureDeviceId(plugin);
  plugin.settings.pendingProtectionCharges = [...new Set((plugin.settings.pendingProtectionCharges ?? []).filter((id) => typeof id === "string" && id.startsWith("evt_")))];
  plugin.settings = { ...plugin.settings, ...resetDailyUsageIfNeeded(plugin.settings) };
  await plugin.saveSettings();
  void diagnostics.guard("billing.background_1", () => (recoverNative({app:plugin.app,settings:plugin.settings,persistNative:()=>plugin.saveSettings()})));
  void diagnostics.guard("billing.background_2", () => (syncBalance(plugin).then(() => retryPendingProtectionCharges(plugin))));

} catch (diagnosticError6) { diagnostics?.failure?.("billing.initializeBilling", diagnosticError6); throw diagnosticError6; } finally { diagnosticEnd6(); }
}

/**
 * Reserve one body/properties protection operation. Free uses are reserved
 * locally. A purchased event is persisted before the write but is only spent
 * after the vault change has been verified, so failed writes never consume a
 * remote credit.
 */
export async function reserveProtectionUse(plugin: AegisNoteLockerPlugin, source = "", result = "", eventId = jobId()): Promise<UseReservation | null> {
const diagnosticEnd7 = diagnostics?.start?.("billing.reserveProtectionUse") ?? (() => {});
try {

  return await (reserveNative({app:plugin.app,settings:plugin.settings,persistNative:()=>plugin.saveSettings()},AEGIS_APP_ID,eventId,source,result,{input_characters:codePoints(source)}));

} catch (diagnosticError7) { diagnostics?.failure?.("billing.reserveProtectionUse", diagnosticError7); throw diagnosticError7; } finally { diagnosticEnd7(); }
}

export async function openCheckout(plugin: AegisNoteLockerPlugin, pack: AegisPackKey): Promise<void> {
const diagnosticEnd8 = diagnostics?.start?.("billing.openCheckout") ?? (() => {});
try {

  await openAccountCheckout({ state: plugin.settings, appId: AEGIS_APP_ID, installationId: ensureDeviceId(plugin),
    persist: () => plugin.saveSettings(), syncBalance: () => syncBalance(plugin), refreshSession: () => refreshBillingSession(plugin.settings, () => plugin.saveSettings())
  }, AEGIS_PLAN_CODES[pack]);

} catch (diagnosticError8) { diagnostics?.failure?.("billing.openCheckout", diagnosticError8); throw diagnosticError8; } finally { diagnosticEnd8(); }
}

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
  try {
    await plugin.saveSettings();
    return true;
  } catch (error) {
    console.warn("Aegis: billing state save failed", error);
    return false;
  }
}

async function fetchBalance(plugin: AegisNoteLockerPlugin): Promise<number> {
  const response = await requestAuthenticatedBilling(plugin.settings, {
    url: `${BASE_URL}/api/v1/billing/entitlements/me?${new URLSearchParams({ app_id: AEGIS_APP_ID, installation_id: plugin.settings.constanceDeviceId }).toString()}`,
    method: "GET",
  });
  if (response.status === 401 || response.status === 403 || response.status === 404) { plugin.settings.billingAccessToken = ""; plugin.settings.billingRefreshToken = ""; plugin.settings.billingAccountLinked = false; await saveBillingState(plugin); throw new Error("Billing session expired"); }
  if (response.status < 200 || response.status >= 300) throw new Error(`Entitlement sync failed: HTTP ${response.status}`);
  if (response.json?.data?.free_usage) {
    plugin.settings.freeUsesDay = localDayKey();
    plugin.settings.freeUsesUsed = Math.max(0, 3 - Number(response.json.data.free_usage.remaining || 0));
  }
  return Math.max(0, Number(response.json?.data?.credits?.balance) || 0);
}

export async function syncBalance(plugin: AegisNoteLockerPlugin, strict = false): Promise<void> {
  registerBillingPersister(plugin.settings, () => plugin.saveSettings());
  resumeAccountCheckout({ state: plugin.settings, appId: AEGIS_APP_ID, installationId: plugin.settings.constanceDeviceId,
    persist: () => plugin.saveSettings(), syncBalance: () => syncBalance(plugin), refreshSession: () => refreshBillingSession(plugin.settings, () => plugin.saveSettings()) });

  const deviceId = ensureDeviceId(plugin);
  try {
    if (!plugin.settings.billingAccessToken || !plugin.settings.billingAccountLinked) { if (strict) throw new Error("Connect your account before refreshing."); return; }
    plugin.settings.purchasedUses = await fetchBalance(plugin);
    await saveBillingState(plugin);
  } catch (error) {
    console.warn("Aegis: Constance balance sync failed", error);
      if (strict) throw error;
  }
}

async function spendPurchasedUse(plugin: AegisNoteLockerPlugin, eventId: string): Promise<SpendResult> {
  try {
    const result = await spendAccountCredits(plugin.settings, AEGIS_APP_ID, plugin.settings.constanceDeviceId, eventId, 1);
    if (result.kind === "auth-required") { plugin.settings.billingAccessToken = ""; plugin.settings.billingRefreshToken = ""; plugin.settings.billingAccountLinked = false; await saveBillingState(plugin); return { kind: "error" }; }
    if (result.kind === "insufficient" || result.kind === "error") return result;
    return { kind: "ok", balance: Math.max(0, result.balance) };
  } catch (error) {
    console.warn("Aegis: Constance credit spend call failed", error);
    return { kind: "error" };
  }
}

/** Retry persisted charges with their original event IDs after an uncertain request. */
export async function retryPendingProtectionCharges(plugin: AegisNoteLockerPlugin): Promise<void> {
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
}

export async function initializeBilling(plugin: AegisNoteLockerPlugin): Promise<void> {
  ensureDeviceId(plugin);
  plugin.settings.pendingProtectionCharges = [...new Set((plugin.settings.pendingProtectionCharges ?? []).filter((id) => typeof id === "string" && id.startsWith("evt_")))];
  plugin.settings = { ...plugin.settings, ...resetDailyUsageIfNeeded(plugin.settings) };
  await plugin.saveSettings();
  void recoverNative({app:plugin.app,settings:plugin.settings,persistNative:()=>plugin.saveSettings()});
  void syncBalance(plugin).then(() => retryPendingProtectionCharges(plugin));
}

/**
 * Reserve one body/properties protection operation. Free uses are reserved
 * locally. A purchased event is persisted before the write but is only spent
 * after the vault change has been verified, so failed writes never consume a
 * remote credit.
 */
export async function reserveProtectionUse(plugin: AegisNoteLockerPlugin, source = "", result = "", eventId = jobId()): Promise<UseReservation | null> {
  return reserveNative({app:plugin.app,settings:plugin.settings,persistNative:()=>plugin.saveSettings()},AEGIS_APP_ID,eventId,source,result,{input_characters:codePoints(source)});
}

export async function openCheckout(plugin: AegisNoteLockerPlugin, pack: AegisPackKey): Promise<void> {
  await openAccountCheckout({ state: plugin.settings, appId: AEGIS_APP_ID, installationId: ensureDeviceId(plugin),
    persist: () => plugin.saveSettings(), syncBalance: () => syncBalance(plugin), refreshSession: () => refreshBillingSession(plugin.settings, () => plugin.saveSettings())
  }, AEGIS_PLAN_CODES[pack]);
}

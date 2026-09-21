import { Notice } from "obsidian";
import type AegisNoteLockerPlugin from "./main";
import { consumeFreeUse, refundFreeUse, resetDailyUsageIfNeeded } from "./usage";
import { claimAccountFreeUsage, requestAuthenticatedBilling, spendAccountCredits } from "./constance-account";

const BASE_URL = "https://app.tutivsoft.com";
export const AEGIS_APP_ID = "aegis-note-locker";

export type AegisPackKey = "usd_001" | "usd_010";

// Live Paddle price ids provisioned for the Aegis catalog row. The plugin
// never talks to Paddle directly.
export const AEGIS_PRICE_IDS: Record<AegisPackKey, string> = {
  usd_001: "pri_01m28hmsg8q4n1p9q1ebhnema4",
  usd_010: "pri_01m28hmtd16ghxd6fdqnsge4rc",
};

// Server-authoritative catalog codes for the authenticated checkout route.
// Price IDs remain only for the legacy /buy fallback.
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
  return Math.max(0, Number(response.json?.data?.credits?.balance) || 0);
}

export async function syncBalance(plugin: AegisNoteLockerPlugin): Promise<void> {
  const deviceId = ensureDeviceId(plugin);
  try {
    if (!plugin.settings.billingAccessToken || !plugin.settings.billingAccountLinked) return;
    plugin.settings.purchasedUses = await fetchBalance(plugin);
    await saveBillingState(plugin);
  } catch (error) {
    console.warn("Aegis: Constance balance sync failed", error);
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
  void syncBalance(plugin).then(() => retryPendingProtectionCharges(plugin));
}

/**
 * Reserve one body/properties protection operation. Free uses are reserved
 * locally. A purchased event is persisted before the write but is only spent
 * after the vault change has been verified, so failed writes never consume a
 * remote credit.
 */
export async function reserveProtectionUse(plugin: AegisNoteLockerPlugin): Promise<UseReservation | null> {
  if (!plugin.settings.billingAccessToken || !plugin.settings.billingAccountLinked) {
    new Notice("Aegis: sign in or create a billing account in plugin settings before protecting a note.");
    return null;
  }
  plugin.settings = { ...plugin.settings, ...resetDailyUsageIfNeeded(plugin.settings) };
  const free = consumeFreeUse(plugin.settings);
  if (free) {
    const accountFree = await claimAccountFreeUsage(plugin.settings, AEGIS_APP_ID, ensureDeviceId(plugin), `free_${generateEventId()}`, 1);
    if (accountFree.kind !== "ok") {
      if (accountFree.kind === "auth-required") { plugin.settings.billingAccessToken = ""; plugin.settings.billingAccountLinked = false; await saveBillingState(plugin); }
      new Notice(accountFree.kind === "insufficient" ? "Aegis: today's account free allowance is exhausted." : "Aegis: the account allowance could not be verified.");
      return null;
    }
    const previous = plugin.settings.freeUsesUsed;
    plugin.settings.freeUsesUsed = Math.max(0, 3 - accountFree.remaining);
    if (!(await saveBillingState(plugin))) {
      plugin.settings.freeUsesUsed = previous;
      return null;
    }
    return {
      source: "free",
      commit: async () => ({ kind: "committed" }),
      rollback: async () => undefined,
    };
  }

  await retryPendingProtectionCharges(plugin);
  if (plugin.settings.pendingProtectionCharges.length > 0) {
    new Notice("Aegis: a previous protection charge is still pending. Refresh your balance or complete the purchase first.");
    return null;
  }
  if (plugin.settings.purchasedUses <= 0) await syncBalance(plugin);
  if (plugin.settings.purchasedUses <= 0) {
    new Notice("Aegis: no protection uses remain. Buy more in Aegis settings.");
    return null;
  }

  const eventId = generateEventId();
  plugin.settings.pendingProtectionCharges = [...plugin.settings.pendingProtectionCharges, eventId];
  if (!(await saveBillingState(plugin))) {
    plugin.settings.pendingProtectionCharges = plugin.settings.pendingProtectionCharges.filter((id) => id !== eventId);
    return null;
  }
  let settled = false;
  return {
    source: "purchased",
    commit: async () => {
      if (settled) return { kind: "committed" };
    const result = await spendPurchasedUse(plugin, eventId);
      if (result.kind === "error") return { kind: "pending" };
      settled = true;
      if (result.kind === "insufficient") {
        plugin.settings.purchasedUses = 0;
        plugin.settings.pendingProtectionCharges = plugin.settings.pendingProtectionCharges.filter((id) => id !== eventId);
        await saveBillingState(plugin);
        return { kind: "insufficient" };
      }
      plugin.settings.purchasedUses = result.balance;
      plugin.settings.pendingProtectionCharges = plugin.settings.pendingProtectionCharges.filter((id) => id !== eventId);
      if (!(await saveBillingState(plugin))) {
        // Keep the event in memory if persistence failed. The same event ID
        // makes the next retry safe if the server already accepted the spend.
        plugin.settings.pendingProtectionCharges = [...plugin.settings.pendingProtectionCharges, eventId];
        return { kind: "pending" };
      }
      return { kind: "committed" };
    },
    rollback: async () => {
      if (settled) return;
      plugin.settings.pendingProtectionCharges = plugin.settings.pendingProtectionCharges.filter((id) => id !== eventId);
      await saveBillingState(plugin);
    },
  };
}

export async function openCheckout(plugin: AegisNoteLockerPlugin, pack: AegisPackKey): Promise<void> {
  if (!plugin.settings.billingAccessToken || !plugin.settings.billingAccountLinked) { new Notice("Sign in or create a billing account in Aegis settings before buying uses."); return; }
  const email = plugin.settings.billingEmail.trim();
  const priceId = AEGIS_PRICE_IDS[pack];
  if (!email || !email.includes("@")) {
    new Notice("Enter a valid billing email in Aegis settings first.");
    return;
  }
  if (!priceId) {
    new Notice("Aegis billing is not available for this pack yet.");
    return;
  }
  const installationId = ensureDeviceId(plugin);
  const planCode = AEGIS_PLAN_CODES[pack];
  if (plugin.settings.pendingCheckoutKey && plugin.settings.pendingCheckoutPack !== pack) {
    new Notice("Aegis: another checkout is still pending. Refresh the balance before starting a new purchase.");
    return;
  }
  const previousKey = plugin.settings.pendingCheckoutKey;
  const previousPack = plugin.settings.pendingCheckoutPack;
  const idempotencyKey = previousKey || `checkout_${generateEventId()}`;
  plugin.settings.pendingCheckoutKey = idempotencyKey;
  plugin.settings.pendingCheckoutPack = pack;
  if (!(await saveBillingState(plugin))) {
    plugin.settings.pendingCheckoutKey = previousKey;
    plugin.settings.pendingCheckoutPack = previousPack;
    new Notice("Aegis could not save the checkout retry state.");
    return;
  }

  let response;
  try {
    response = await requestAuthenticatedBilling(plugin.settings, {
      url: `${BASE_URL}/api/v1/billing/checkout`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ app_id: AEGIS_APP_ID, plan_code: planCode, installation_id: installationId, quantity: 1, coupon_code: null }),
    });
  } catch {
    new Notice("Aegis checkout could not be reached. Retry with the same checkout request.");
    return;
  }
  if (response.status === 401 || response.status === 403) {
    plugin.settings.billingAccessToken = "";
    plugin.settings.billingRefreshToken = "";
    plugin.settings.billingAccountLinked = false;
    await saveBillingState(plugin);
    new Notice("Aegis billing session expired. Sign in again before buying uses.");
    return;
  }
  if (response.status >= 200 && response.status < 300) {
    const checkoutUrl = String(response.json?.data?.checkout_url || "");
    if (checkoutUrl) {
      window.open(checkoutUrl, "_blank");
      plugin.settings.pendingCheckoutKey = "";
      plugin.settings.pendingCheckoutPack = "";
      await saveBillingState(plugin);
      plugin.pollAfterCheckout();
      return;
    }
    new Notice("Aegis checkout was created but did not return a checkout URL. Refresh the balance and retry if needed.");
    return;
  }
  if (response.status >= 500 || response.status === 0) {
    new Notice("Aegis checkout is temporarily unavailable. Retry with the same checkout request.");
    return;
  }
  if (response.status === 409) {
    new Notice("Aegis checkout could not be retried safely. Refresh the balance and try again.");
    return;
  }

  if (response.status !== 400 && response.status !== 404 && response.status !== 405) {
    new Notice(`Aegis checkout failed (HTTP ${response.status}).`);
    return;
  }

  // Legacy fallback: /buy cannot carry a billing return URL, so fulfillment
  // still comes only from webhook processing and the polling refresh above.
  const params = new URLSearchParams({ app_id: AEGIS_APP_ID, price_id: priceId, email, external_customer_id: installationId });
  window.open(`${BASE_URL}/buy?${params.toString()}`, "_blank");
  plugin.settings.pendingCheckoutKey = "";
  plugin.settings.pendingCheckoutPack = "";
  await saveBillingState(plugin);
  plugin.pollAfterCheckout();
}

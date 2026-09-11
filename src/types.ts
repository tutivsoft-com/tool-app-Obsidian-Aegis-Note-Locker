import type { AegisEnvelope } from "./crypto";

export interface AegisSettings {
  sessionTimeoutMinutes: number;
  backupFolder: string;
  showStatusBar: boolean;
  constanceDeviceId: string;
  billingEmail: string;
  freeUsesDay: string;
  freeUsesUsed: number;
  purchasedUses: number;
  pendingProtectionCharges: string[];
}

export const DEFAULT_SETTINGS: AegisSettings = {
  sessionTimeoutMinutes: 15,
  backupFolder: ".aegis-backups",
  showStatusBar: true,
  constanceDeviceId: "",
  billingEmail: "",
  freeUsesDay: "",
  freeUsesUsed: 0,
  purchasedUses: 0,
  pendingProtectionCharges: [],
};

export interface AegisRecord {
  mode: "note" | "properties";
  envelope?: AegisEnvelope;
  properties?: Record<string, AegisEnvelope>;
}

export interface UndoEntry {
  path: string;
  original: string;
  resulting: string;
}

export interface UndoRecord {
  createdAt: number;
  entries: UndoEntry[];
}

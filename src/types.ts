import type { AegisEnvelope } from "./crypto";

export interface AegisSettings {
  sessionTimeoutMinutes: number;
  backupFolder: string;
  showStatusBar: boolean;
}

export const DEFAULT_SETTINGS: AegisSettings = {
  sessionTimeoutMinutes: 15,
  backupFolder: ".aegis-backups",
  showStatusBar: true,
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

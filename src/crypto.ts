export const AEGIS_FORMAT_VERSION = 1;
export const DEFAULT_PBKDF2_ITERATIONS = 310_000;

export interface AegisEnvelope {
  v: number;
  alg: "AES-256-GCM";
  kdf: "PBKDF2-HMAC-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is unavailable in this runtime.");
  return globalThis.crypto;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  const result = new Uint8Array(length);
  cryptoApi().getRandomValues(result);
  return result;
}

function source(bytes: Uint8Array): BufferSource { return bytes as unknown as BufferSource; }

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await cryptoApi().subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return cryptoApi().subtle.deriveKey(
    { name: "PBKDF2", salt: source(salt), iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function validateEnvelope(value: unknown): asserts value is AegisEnvelope {
  if (!value || typeof value !== "object") throw new Error("Invalid Aegis envelope.");
  const envelope = value as Partial<AegisEnvelope>;
  if (
    envelope.v !== AEGIS_FORMAT_VERSION ||
    envelope.alg !== "AES-256-GCM" ||
    envelope.kdf !== "PBKDF2-HMAC-SHA256" ||
    typeof envelope.iterations !== "number" ||
    envelope.iterations < 100_000 ||
    typeof envelope.salt !== "string" ||
    typeof envelope.iv !== "string" ||
    typeof envelope.ciphertext !== "string" ||
    typeof envelope.tag !== "string"
  ) {
    throw new Error("Unsupported or malformed Aegis envelope.");
  }
}

export async function encryptText(
  plaintext: string,
  password: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS,
): Promise<AegisEnvelope> {
  if (!password) throw new Error("A password is required.");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt, iterations);
  const encrypted = await cryptoApi().subtle.encrypt(
    { name: "AES-GCM", iv: source(iv) },
    key,
    new TextEncoder().encode(plaintext),
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
    tag: bytesToBase64(encryptedBytes.slice(-tagLength)),
  };
}

export async function decryptText(envelope: AegisEnvelope, password: string): Promise<string> {
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
    source(ciphertextAndTag),
  );
  return new TextDecoder().decode(plaintext);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await cryptoApi().subtle.digest("SHA-256", source(new TextEncoder().encode(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function clearBytes(value: Uint8Array | undefined): void {
  value?.fill(0);
}

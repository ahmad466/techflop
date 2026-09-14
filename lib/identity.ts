import { base58 } from "@scure/base";
import * as ed from "@noble/ed25519";

const STORAGE_KEY = "techflop.identity.v1";
const TCID_FORMAT = "technocore-tcid";
const TCID_ITERATIONS = 250000;

export type Identity = {
  did: string;
  secretKey: string;
  publicKey: string;
  fingerprint: string;
  createdAt: string;
};

type TcidFile = {
  format: typeof TCID_FORMAT;
  version: 1;
  did: string;
  createdAt: string;
  crypto: {
    kdf: "PBKDF2-SHA256";
    iterations: number;
    salt: string;
    cipher: "AES-256-GCM";
    iv: string;
    ciphertext: string;
  };
};

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  const clean = hex.trim();
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) throw new Error("Secret key bukan hex yang valid.");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

function base64ToBytes(input: string) {
  const binary = atob(input);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function base64url(bytes: Uint8Array) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - input.length % 4) % 4);
  return base64ToBytes(normalized);
}

function didFromPublicKey(pub: Uint8Array) {
  const multicodec = new Uint8Array([0xed, 0x01, ...pub]);
  return `did:key:z${base58.encode(multicodec)}`;
}

export async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hash));
}

export async function createIdentity(): Promise<Identity> {
  const secret = ed.utils.randomSecretKey();
  const pub = await ed.getPublicKeyAsync(secret);
  const did = didFromPublicKey(pub);
  return {
    did,
    secretKey: bytesToHex(secret),
    publicKey: bytesToHex(pub),
    fingerprint: (await sha256Hex(did)).slice(0, 16),
    createdAt: new Date().toISOString()
  };
}

export function saveIdentity(identity: Identity) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearIdentity() {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportIdentityJson(identity: Identity) {
  const payload = JSON.stringify({
    format: "techflop-identity-v1",
    warning: "KEEP secretKey private. Anyone with it can sign as this DID.",
    identity
  }, null, 2);
  return new Blob([payload], { type: "application/json" });
}

// Backwards-compatible alias used by the original TechFlop starter.
export const exportIdentity = exportIdentityJson;

export function exportIdentityPem(identity: Identity) {
  const secret = hexToBytes(identity.secretKey);
  if (secret.length !== 32) throw new Error("Secret key harus 32 byte.");

  // PKCS#8 Ed25519: RFC 8410 OneAsymmetricKey containing the 32-byte seed.
  const prefix = hexToBytes("302e020100300506032b657004220420");
  const der = new Uint8Array(prefix.length + secret.length);
  der.set(prefix, 0);
  der.set(secret, prefix.length);
  const b64 = bytesToBase64(der).match(/.{1,64}/g)?.join("\n") ?? "";
  return new Blob([`-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`], { type: "application/x-pem-file" });
}

export async function exportIdentityTcid(identity: Identity, password: string) {
  if (!password) throw new Error("Password TCID wajib diisi.");
  const secret = hexToBytes(identity.secretKey);
  if (secret.length !== 32) throw new Error("Secret key harus 32 byte.");

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: TCID_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const plaintext = new TextEncoder().encode(JSON.stringify({ secretKey: identity.secretKey }));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  const tcid: TcidFile = {
    format: TCID_FORMAT,
    version: 1,
    did: identity.did,
    createdAt: identity.createdAt,
    crypto: {
      kdf: "PBKDF2-SHA256",
      iterations: TCID_ITERATIONS,
      salt: bytesToBase64(salt),
      cipher: "AES-256-GCM",
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext))
    }
  };

  return new Blob([JSON.stringify(tcid, null, 2)], { type: "application/json" });
}

export async function importIdentity(raw: string, password?: string, filename?: string): Promise<Identity> {
  const trimmed = raw.trim();
  const lowerName = (filename ?? "").toLowerCase();

  if (lowerName.endsWith(".pem") || trimmed.includes("-----BEGIN PRIVATE KEY-----")) {
    return importPem(trimmed);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("File identity bukan JSON/TCID yang valid.");
  }

  if (parsed?.format === TCID_FORMAT) {
    if (!password) throw new Error("TCID ini terenkripsi. Masukkan password untuk membukanya.");
    return importTcid(parsed as TcidFile, password);
  }

  const identity = parsed?.identity ?? parsed;
  if (!identity?.did || !identity?.secretKey) throw new Error("Identity backup tidak lengkap.");
  return identityFromSecret(identity.secretKey, identity.did, identity.createdAt);
}

async function decryptTcidSecret(tcid: TcidFile, password: string): Promise<string> {
  if (tcid.version !== 1 || tcid.crypto?.kdf !== "PBKDF2-SHA256" || tcid.crypto?.cipher !== "AES-256-GCM") {
    throw new Error("Format TCID tidak didukung.");
  }

  const salt = base64ToBytes(tcid.crypto.salt);
  const iv = base64ToBytes(tcid.crypto.iv);
  const ciphertext = base64ToBytes(tcid.crypto.ciphertext);
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: tcid.crypto.iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  const decoded = new TextDecoder().decode(plaintext).trim();
  try {
    const payload = JSON.parse(decoded);
    return payload.secretKey ?? payload.privateKey ?? payload.secret_key ?? decoded;
  } catch {
    return decoded;
  }
}

async function importTcid(tcid: TcidFile, password: string) {
  if (tcid.version !== 1 || tcid.crypto?.kdf !== "PBKDF2-SHA256" || tcid.crypto?.cipher !== "AES-256-GCM") {
    throw new Error("Format TCID tidak didukung.");
  }

  try {
    const secretKey = await decryptTcidSecret(tcid, password);
    return await identityFromSecret(secretKey, tcid.did, tcid.createdAt);
  } catch {
    throw new Error("Gagal membuka TCID. Password salah atau file rusak.");
  }
}


export async function recoverLegacyTcidAsPem(raw: string, password: string) {
  if (!password) throw new Error("Password TCID wajib diisi.");
  let parsed: any;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    throw new Error("File TCID bukan JSON yang valid.");
  }
  if (parsed?.format !== TCID_FORMAT) throw new Error("File ini bukan TCID Technocore.");

  try {
    const secretKey = await decryptTcidSecret(parsed as TcidFile, password);
    // Deliberately do not validate the legacy metadata DID here. Some older
    // TCIDs contain stale DID metadata while the encrypted seed is valid.
    const recovered = await identityFromSecret(secretKey, undefined, parsed.createdAt);
    return {
      blob: exportIdentityPem(recovered),
      identity: recovered,
      legacyDid: parsed.did as string | undefined,
      didChanged: !!parsed.did && parsed.did !== recovered.did,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Secret key bukan hex")) throw error;
    throw new Error("Gagal membuka TCID. Password salah atau file rusak.");
  }
}

function importPem(pem: string) {
  const match = pem.match(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/);
  if (!match) throw new Error("PEM private key tidak valid.");
  const label = match[1];
  if (label !== "PRIVATE KEY") throw new Error("Gunakan Ed25519 PKCS#8 PEM (BEGIN PRIVATE KEY).");
  const der = base64ToBytes(match[2].replace(/\s/g, ""));
  const prefix = hexToBytes("302e020100300506032b657004220420");
  if (der.length !== prefix.length + 32) throw new Error("Ukuran Ed25519 PKCS#8 tidak valid.");
  for (let i = 0; i < prefix.length; i++) if (der[i] !== prefix[i]) throw new Error("PEM bukan Ed25519 PKCS#8 yang didukung.");
  return identityFromSecret(bytesToHex(der.slice(prefix.length)));
}

async function identityFromSecret(secretKey: string, expectedDid?: string, createdAt?: string): Promise<Identity> {
  const secret = hexToBytes(secretKey);
  if (secret.length !== 32) throw new Error("Secret key harus 32 byte.");
  const pub = await ed.getPublicKeyAsync(secret);
  const publicKey = bytesToHex(pub);
  const did = didFromPublicKey(pub);
  if (expectedDid && did !== expectedDid) throw new Error("Secret key tidak cocok dengan DID.");
  return {
    did,
    secretKey: bytesToHex(secret),
    publicKey,
    fingerprint: (await sha256Hex(did)).slice(0, 16),
    createdAt: createdAt ?? new Date().toISOString()
  };
}

export async function signMessage(identity: Identity, room: string, nonce: string, text: string) {
  const canonical = `${room}|${nonce}|${text}`;
  const sig = await ed.signAsync(new TextEncoder().encode(canonical), hexToBytes(identity.secretKey));
  return base64url(sig);
}

export async function verifySignature(did: string, room: string, nonce: string, text: string, signature: string) {
  try {
    if (!did.startsWith("did:key:")) return false;
    const encoded = did.slice("did:key:".length);
    if (!encoded.startsWith("z")) return false;
    const bytes = base58.decode(encoded.slice(1));
    if (bytes.length !== 34 || bytes[0] !== 0xed || bytes[1] !== 0x01) return false;
    const pub = bytes.slice(2);
    const sig = base64urlDecode(signature);
    if (sig.length !== 64) return false;
    const canonical = `${room}|${nonce}|${text}`;
    return await ed.verifyAsync(sig, new TextEncoder().encode(canonical), pub);
  } catch {
    return false;
  }
}

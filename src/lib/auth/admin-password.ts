import crypto from "crypto";

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey as Buffer);
    });
  });
}

export async function hashAdminPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await deriveKey(password, salt);
  return `scrypt$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

export async function verifyAdminPassword(password: string, storedHash: string) {
  const [algorithm, encodedSalt, encodedKey, ...rest] = storedHash.split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedKey || rest.length > 0) return false;

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expectedKey = Buffer.from(encodedKey, "base64url");
    if (salt.length !== 16 || expectedKey.length !== KEY_LENGTH) return false;
    const derivedKey = await deriveKey(password, salt);
    return crypto.timingSafeEqual(derivedKey, expectedKey);
  } catch {
    return false;
  }
}

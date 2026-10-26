import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Guest image encryption: AES-256-GCM, stored as [12-byte IV][16-byte tag][ciphertext].

export function encryptBytes(data: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

/** Throws when the key is wrong or the data was changed. */
export function decryptBytes(data: Buffer, key: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]);
}

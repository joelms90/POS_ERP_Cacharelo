import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const secret = process.env.PIN_ENCRYPTION_KEY || process.env.JWT_SECRET || 'cacharelo-pin-secret-key-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext PIN using AES-256-GCM.
 * Returns a composite string in the format: "iv:authTag:encryptedHex".
 */
export function encryptPin(pin: string): string {
  if (!pin) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(pin, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted composite string back to the plaintext PIN.
 * Returns null if decryption fails or if input is empty/invalid.
 */
export function decryptPin(encryptedPin: string | null | undefined): string | null {
  if (!encryptedPin || typeof encryptedPin !== 'string') return null;
  const parts = encryptedPin.split(':');
  if (parts.length !== 3) return null;

  const [ivHex, authTagHex, encrypted] = parts;
  if (!ivHex || !authTagHex || !encrypted) return null;

  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
}

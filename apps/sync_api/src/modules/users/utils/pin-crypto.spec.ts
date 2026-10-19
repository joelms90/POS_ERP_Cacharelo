import { encryptPin, decryptPin } from './pin-crypto';

describe('pin-crypto', () => {
  it('should encrypt and decrypt a 4-digit PIN accurately', () => {
    const pin = '4321';
    const encrypted = encryptPin(pin);

    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toEqual(pin);
    expect(encrypted.split(':').length).toBe(3);

    const decrypted = decryptPin(encrypted);
    expect(decrypted).toBe(pin);
  });

  it('should return null when decrypting invalid or corrupted ciphertext', () => {
    expect(decryptPin(null)).toBeNull();
    expect(decryptPin(undefined)).toBeNull();
    expect(decryptPin('')).toBeNull();
    expect(decryptPin('invalid-format')).toBeNull();
    expect(decryptPin('abc:def:123')).toBeNull();
  });

  it('should return empty string when encrypting empty pin', () => {
    expect(encryptPin('')).toBe('');
  });
});

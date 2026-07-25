import { decryptSecret, encryptSecret } from './crypto.util';

describe('crypto.util', () => {
  const secret = 'test-integrations-secret-material';

  it('round-trips plaintext', () => {
    const cipher = encryptSecret('smtp-password', secret);
    expect(cipher).not.toContain('smtp-password');
    expect(decryptSecret(cipher, secret)).toBe('smtp-password');
  });

  it('produces different ciphertext each call', () => {
    const a = encryptSecret('same', secret);
    const b = encryptSecret('same', secret);
    expect(a).not.toBe(b);
  });

  it('fails with wrong key', () => {
    const cipher = encryptSecret('secret', secret);
    expect(() => decryptSecret(cipher, 'other-key')).toThrow();
  });
});

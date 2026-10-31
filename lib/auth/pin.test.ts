import { describe, expect, it } from 'vitest';
import { hashPin, verifyPin } from './pin';

describe('PIN', () => {
  it('băm bằng argon2id', async () => {
    expect(await hashPin('1234')).toMatch(/^\$argon2id\$/);
  });

  it('chỉ khớp đúng PIN', async () => {
    const hash = await hashPin('1234');
    await expect(verifyPin(hash, '1234')).resolves.toBe(true);
    await expect(verifyPin(hash, '4321')).resolves.toBe(false);
  });
});

import argon2 from 'argon2';

/** Băm PIN bằng argon2id; chỉ lưu kết quả này, không bao giờ lưu PIN gốc. */
export function hashPin(pin: string): Promise<string> {
  return argon2.hash(pin, { type: argon2.argon2id });
}

export function verifyPin(hash: string, pin: string): Promise<boolean> {
  return argon2.verify(hash, pin);
}

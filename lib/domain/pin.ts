import { randomInt } from 'node:crypto';

/** PIN tự sinh 4 số (US11). */
export function generatePin(): string {
  return randomInt(0, 10_000).toString().padStart(4, '0');
}

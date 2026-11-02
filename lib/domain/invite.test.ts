import { describe, expect, it } from 'vitest';
import { inviteLink, inviteMessage } from './invite';

describe('tin nhắn mời', () => {
  const link = inviteLink('https://quan.vn', 'PHONHO');
  const base = { name: 'An', email: 'an@x.vn', link, companyCode: 'PHONHO' };

  it('link có mã công ty', () => {
    expect(link).toBe('https://quan.vn/m?ma=PHONHO');
  });

  it('có PIN thì kèm PIN, không có thì nhắc hỏi quản lý', () => {
    expect(inviteMessage({ ...base, pin: '0420' })).toContain('PIN: 0420');
    expect(inviteMessage(base)).toContain('PIN: hỏi quản lý');
    expect(inviteMessage(base)).toContain(link);
  });
});

import { describe, expect, it } from 'vitest';
import { leaveTarget } from './leave-guard';

const CURRENT = 'https://chamcong.vn/app/cai-dat?tab=a';
const click = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
};
const anchor = { href: 'https://chamcong.vn/app/luong', target: '', hasDownload: false };

describe('leaveTarget', () => {
  it('nhận link sang trang khác, kể cả chỉ đổi query hoặc ra ngoài site', () => {
    expect(leaveTarget(click, anchor, CURRENT)?.pathname).toBe('/app/luong');
    expect(leaveTarget(click, { ...anchor, href: '/app/cai-dat?tab=b' }, CURRENT)?.search).toBe('?tab=b');
    expect(leaveTarget(click, { ...anchor, href: 'https://example.com/' }, CURRENT)?.origin).toBe(
      'https://example.com',
    );
  });

  it('bỏ qua link tới chính trang này hoặc chỉ đổi #hash', () => {
    expect(leaveTarget(click, { ...anchor, href: CURRENT }, CURRENT)).toBeNull();
    expect(leaveTarget(click, { ...anchor, href: `${CURRENT}#muc-2` }, CURRENT)).toBeNull();
  });

  it('bỏ qua cú bấm mở tab mới', () => {
    expect(leaveTarget({ ...click, ctrlKey: true }, anchor, CURRENT)).toBeNull();
    expect(leaveTarget({ ...click, metaKey: true }, anchor, CURRENT)).toBeNull();
    expect(leaveTarget({ ...click, button: 1 }, anchor, CURRENT)).toBeNull();
    expect(leaveTarget(click, { ...anchor, target: '_blank' }, CURRENT)).toBeNull();
  });

  it('bỏ qua tải file, mailto, tel và cú bấm đã được xử lý', () => {
    expect(leaveTarget(click, { ...anchor, hasDownload: true }, CURRENT)).toBeNull();
    expect(leaveTarget(click, { ...anchor, href: 'mailto:a@b.vn' }, CURRENT)).toBeNull();
    expect(leaveTarget(click, { ...anchor, href: 'tel:0900000000' }, CURRENT)).toBeNull();
    expect(leaveTarget({ ...click, defaultPrevented: true }, anchor, CURRENT)).toBeNull();
  });
});

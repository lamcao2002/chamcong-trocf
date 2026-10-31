type ClickLike = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
};

type AnchorLike = {
  href: string;
  target: string;
  hasDownload: boolean;
};

/**
 * Đích của cú bấm link nếu nó sẽ rời trang hiện tại trong tab này; ngược lại trả về null
 * (mở tab mới, tải file, mailto, hoặc chỉ đổi #hash).
 */
export function leaveTarget(click: ClickLike, anchor: AnchorLike, currentHref: string): URL | null {
  if (click.defaultPrevented || click.button !== 0) return null;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  if (anchor.hasDownload || (anchor.target !== '' && anchor.target !== '_self')) return null;

  const url = new URL(anchor.href, currentHref);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const current = new URL(currentHref);
  const samePage =
    url.origin === current.origin && url.pathname === current.pathname && url.search === current.search;
  return samePage ? null : url;
}

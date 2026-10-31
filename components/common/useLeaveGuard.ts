'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { leaveTarget } from '@/lib/navigation/leave-guard';
import { useConfirmDiscard } from './useConfirmDiscard';

const SENTINEL_KEY = 'leaveGuardSentinel';

function hasSentinel() {
  return Boolean((window.history.state as Record<string, unknown> | null)?.[SENTINEL_KEY]);
}

/** Mục history đệm để bắt nút Back. Giữ nguyên state vì Next.js đọc `__NA` trong đó. */
function pushSentinel() {
  window.history.pushState({ ...window.history.state, [SENTINEL_KEY]: true }, '');
}

/**
 * Hỏi xác nhận khi rời trang lúc `when` bật: bấm link, Back/Forward, tải lại, đóng tab.
 * App Router không có sự kiện chuyển trang nên phải chặn ở tầng trình duyệt.
 * Lưu xong mục đệm vẫn còn: lần Back kế tiếp đứng yên tại trang, chấp nhận được.
 */
export function useLeaveGuard(when: boolean) {
  const router = useRouter();
  const confirmDiscard = useConfirmDiscard();

  useEffect(() => {
    if (!when) return;

    let asking = false;

    const ask = async (leave: () => void, stay?: () => void) => {
      if (asking) return;
      asking = true;
      const confirmed = await confirmDiscard();
      asking = false;
      if (!confirmed) {
        stay?.();
        return;
      }
      disarm();
      leave();
    };

    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const target = leaveTarget(
        event,
        { href: anchor.href, target: anchor.target, hasDownload: anchor.hasAttribute('download') },
        window.location.href,
      );
      if (!target) return;

      event.preventDefault();
      event.stopPropagation();
      void ask(() => {
        if (target.origin === window.location.origin) {
          router.push(`${target.pathname}${target.search}${target.hash}`);
        } else {
          window.location.assign(target);
        }
      });
    };

    const onPopState = () => {
      if (hasSentinel()) return;
      void ask(
        () => window.history.back(),
        () => pushSentinel(),
      );
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();

    function disarm() {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('beforeunload', onBeforeUnload);
    }

    if (!hasSentinel()) pushSentinel();
    // Bắt ở window, pha capture: chạy trước onClick của next/link
    window.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('beforeunload', onBeforeUnload);
    return disarm;
  }, [when, router, confirmDiscard]);
}

'use client';

import { useCallback } from 'react';
import { useToast } from './useToast';

/** Đăng xuất rồi về `redirectTo`; tải lại hẳn để người dùng sau không thấy cache của phiên này. */
export function useLogout(redirectTo: string) {
  const toast = useToast();

  return useCallback(async () => {
    const response = await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => null);
    if (response?.ok) {
      window.location.replace(redirectTo);
    } else {
      toast.error('Không đăng xuất được, vui lòng thử lại');
    }
  }, [redirectTo, toast]);
}

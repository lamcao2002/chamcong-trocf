'use client';

import { InputNumber, type InputNumberProps } from 'antd';
import { formatNumber } from '@/lib/format';

/** Ô nhập tiền dạng 1.234.567, lưu số nguyên đồng. */
export function MoneyInput(props: InputNumberProps<number>) {
  return (
    <InputNumber<number>
      {...props}
      min={0}
      precision={0}
      addonAfter="đ"
      style={{ width: '100%' }}
      inputMode="numeric"
      formatter={(value) => (String(value ?? '') === '' ? '' : formatNumber(Number(value)))}
      // Ô trống phải là "chưa nhập" chứ không phải 0đ
      parser={(value) => {
        const digits = (value ?? '').replace(/\D/g, '');
        return (digits ? Number(digits) : undefined) as number;
      }}
    />
  );
}

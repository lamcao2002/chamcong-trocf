'use client';

import { useState } from 'react';
import { Button, Flex, Input, Modal } from 'antd';
import type { InboxItem } from '@/lib/services/inbox';

type InboxActionsProps = {
  item: InboxItem;
  busy: boolean;
  onApprove: () => void;
  onAdjust: () => void;
  onLater: () => void;
  onDecide: (decision: 'approve' | 'reject', note?: string) => void;
};

/** Duyệt theo đề xuất, Điều chỉnh khác, Để sau; đơn thì Duyệt, Từ chối (US25, US26, US33). */
export function InboxActions({ item, busy, onApprove, onAdjust, onLater, onDecide }: InboxActionsProps) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  if (item.requestId) {
    return (
      <Flex wrap gap={8}>
        <Button type="primary" loading={busy} onClick={() => onDecide('approve')}>
          Duyệt đơn
        </Button>
        <Button danger disabled={busy} onClick={() => setRejecting(true)}>
          Từ chối
        </Button>
        <Button type="text" disabled={busy} onClick={onLater}>
          Để sau
        </Button>
        <Modal
          open={rejecting}
          title="Từ chối đơn"
          okText="Từ chối đơn"
          okButtonProps={{ danger: true }}
          cancelText="Quay lại"
          onCancel={() => setRejecting(false)}
          onOk={() => {
            setRejecting(false);
            onDecide('reject', note.trim() || undefined);
          }}
        >
          <Input.TextArea
            rows={3}
            maxLength={500}
            aria-label="Lý do từ chối"
            placeholder="Lý do (không bắt buộc), nhân viên sẽ thấy trong app"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Modal>
      </Flex>
    );
  }

  return (
    <Flex wrap gap={8}>
      {item.suggestion ? (
        <Button type="primary" loading={busy} onClick={onApprove}>
          {item.suggestion.label}
        </Button>
      ) : null}
      <Button disabled={busy} onClick={onAdjust}>
        Điều chỉnh khác…
      </Button>
      <Button type="text" disabled={busy} onClick={onLater}>
        Để sau
      </Button>
    </Flex>
  );
}

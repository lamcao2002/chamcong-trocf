'use client';

import Link from 'next/link';
import { Button, Empty, Form, Input, InputNumber } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { MoneyInput } from '@/components/admin/config/MoneyInput';
import { FormDrawer } from '@/components/common/FormDrawer';
import { useCrudDrawer } from '@/components/common/useCrudDrawer';
import { MAX_SCARS, penaltyValueLabel } from '@/lib/domain/penalties';
import type { PenaltyRuleView } from '@/lib/services/penalties';
import { penaltyRuleSchema, type PenaltyRuleInput } from '@/lib/validation/penalty';
import styles from './penalties.module.css';

type RulesTabProps = { rules: PenaltyRuleView[]; canEdit: boolean; scarThreshold: number | null };

/** Danh sách quy định: mỗi quy định quy ra sẹo, tiền hoặc cả hai. Chỉ Quản trị viên sửa. */
export function RulesTab({ rules, canEdit, scarThreshold }: RulesTabProps) {
  const drawer = useCrudDrawer<PenaltyRuleInput>({
    baseUrl: '/api/v1/penalty-rules',
    schema: penaltyRuleSchema,
    label: 'quy định',
    toBody: (values) => ({ ...values, scars: values.scars ?? 0, amount: values.amount ?? 0 }),
  });
  const editing = rules.find(({ id }) => id === drawer.editingId);

  return (
    <>
      <div className={styles.filters}>
        {canEdit ? (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => drawer.openWith({ name: '', scars: 1, amount: 0, note: null })}
          >
            Thêm quy định
          </Button>
        ) : null}
      </div>
      <p className={styles.muted}>
        {scarThreshold
          ? `Đủ ${scarThreshold} sẹo trong một kỳ lương thì nhân viên được cảnh báo; sang kỳ mới sẹo về 0.`
          : 'Chưa đặt ngưỡng cảnh báo sẹo.'}{' '}
        {canEdit ? <Link href="/app/cai-dat">Đổi ngưỡng ở Cài đặt</Link> : null}
        {canEdit ? null : ' Chỉ Quản trị viên sửa được danh sách này.'}
      </p>

      {rules.length === 0 ? (
        <Empty description="Chưa có quy định nào" />
      ) : (
        <ul className={styles.list}>
          {rules.map((rule) => (
            <li key={rule.id}>
              <button
                type="button"
                className={styles.row}
                aria-label={canEdit ? `Sửa quy định ${rule.name}` : rule.name}
                disabled={!canEdit}
                onClick={() =>
                  drawer.openWith(
                    { name: rule.name, scars: rule.scars, amount: rule.amount, note: rule.note },
                    rule.id,
                  )
                }
              >
                <span className={styles.rowMain}>
                  <strong>{rule.name}</strong>
                  {rule.note ? <span className={styles.muted}>{rule.note}</span> : null}
                </span>
                <span className={styles.value}>{penaltyValueLabel(rule)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <FormDrawer
        open={drawer.open}
        title={editing ? `Sửa quy định: ${editing.name}` : 'Thêm quy định phạt'}
        dirty={drawer.dirty}
        saving={drawer.saving}
        submitLabel="Lưu quy định"
        onClose={drawer.close}
        onSubmit={() => void drawer.submit()}
        footerExtra={
          editing ? (
            <Button
              danger
              type="text"
              onClick={() => void drawer.remove(editing.id, `quy định ${editing.name}`)}
            >
              Xoá
            </Button>
          ) : null
        }
      >
        <Form
          form={drawer.form}
          layout="vertical"
          requiredMark={false}
          initialValues={drawer.initialValues}
          onValuesChange={drawer.handleValuesChange}
        >
          <Form.Item label="Vi phạm" name="name">
            <Input placeholder="VD: Đi trễ không báo, Làm vỡ ly" maxLength={120} />
          </Form.Item>
          <Form.Item label="Số sẹo" name="scars" extra="Để 0 nếu chỉ phạt tiền.">
            <InputNumber min={0} max={MAX_SCARS} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="Tiền phạt"
            name="amount"
            extra="Để 0 nếu chỉ tính sẹo. Tiền phạt không tự trừ lương."
          >
            <MoneyInput />
          </Form.Item>
          <Form.Item label="Ghi chú" name="note">
            <Input.TextArea rows={2} maxLength={300} placeholder="VD: trễ quá 15 phút mới tính" />
          </Form.Item>
        </Form>
        {editing ? (
          <p className={styles.muted}>
            Sửa quy định không đổi các phiếu đã phạt. Xoá quy định đã dùng thì quy định chỉ ẩn khỏi danh sách
            chọn.
          </p>
        ) : null}
      </FormDrawer>
    </>
  );
}

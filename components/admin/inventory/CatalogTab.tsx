'use client';

import { useMemo, useState } from 'react';
import { AutoComplete, Button, Empty, Form, Input, InputNumber, Radio, Segmented, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { FormDrawer } from '@/components/common/FormDrawer';
import { useCrudDrawer } from '@/components/common/useCrudDrawer';
import { groupByKind, INVENTORY_KIND_LABELS, MAX_QUANTITY } from '@/lib/domain/inventory';
import { formatDecimal } from '@/lib/format';
import type { InventoryItemView, InventoryListView } from '@/lib/services/inventory';
import { inventoryItemSchema, type InventoryItemInput, type InventoryKind } from '@/lib/validation/inventory';
import styles from './inventory.module.css';

const UNITS = ['cái', 'chai', 'lon', 'hộp', 'gói', 'túi', 'kg', 'gam', 'lít', 'ml', 'bộ', 'cuộn'];

type Filter = 'all' | InventoryKind;

/** Danh mục món của quán: nhập trước, rồi lấy món vào các phiếu kiểm kê. */
export function CatalogTab({ list }: { list: InventoryListView }) {
  const { items, sheets } = list;
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const drawer = useCrudDrawer<InventoryItemInput>({
    baseUrl: '/api/v1/inventory/items',
    schema: inventoryItemSchema,
    label: 'món',
  });
  const editing = items.find(({ id }) => id === drawer.editingId);
  const sheetsOf = (id: string) => sheets.filter((sheet) => sheet.items.some((item) => item.id === id));
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        (filter === 'all' || item.kind === filter) && (!needle || item.name.toLowerCase().includes(needle)),
    );
  }, [items, filter, query]);
  const count = (kind: Filter) =>
    kind === 'all' ? items.length : items.filter((item) => item.kind === kind).length;

  const openItem = ({ id, kind, name, unit, quantity, note }: InventoryItemView) =>
    drawer.openWith({ kind, name, unit, quantity, note }, id);
  const used = editing ? sheetsOf(editing.id) : [];

  return (
    <>
      <div className={styles.filters}>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={(['all', 'vat_dung', 'nguyen_lieu'] as const).map((value) => ({
            value,
            label: `${value === 'all' ? 'Tất cả' : INVENTORY_KIND_LABELS[value]} (${count(value)})`,
          }))}
        />
        <Input.Search
          allowClear
          placeholder="Tìm món"
          aria-label="Tìm món"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ flex: '1 1 160px', maxWidth: 240 }}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() =>
            drawer.openWith({
              kind: filter === 'nguyen_lieu' ? 'nguyen_lieu' : 'vat_dung',
              quantity: 0,
              unit: 'cái',
            })
          }
        >
          Thêm món
        </Button>
      </div>
      <p className={styles.muted}>
        Nhập mọi vật dụng, nguyên liệu cần kiểm ở đây rồi lấy vào phiếu kiểm kê. Số hiện có là số chung của
        quán: phiếu nào được duyệt cũng cập nhật số này.
      </p>

      {shown.length === 0 ? (
        <Empty description={items.length === 0 ? 'Danh mục chưa có món nào' : 'Không có món khớp bộ lọc'} />
      ) : (
        groupByKind(shown).map(({ kind, label, rows }) => (
          <section key={kind} aria-label={label}>
            {filter === 'all' ? <h3 className={styles.groupTitle}>{label}</h3> : null}
            <ul className={styles.list}>
              {rows.map((item) => {
                const inSheets = sheetsOf(item.id).length;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={styles.row}
                      aria-label={`Sửa ${item.name}`}
                      onClick={() => openItem(item)}
                    >
                      <span className={styles.rowMain}>
                        <strong>{item.name}</strong>
                        <span className={styles.muted}>
                          {inSheets > 0 ? `Trong ${inSheets} phiếu` : 'Chưa ở phiếu nào'}
                          {item.note ? ` · ${item.note}` : ''}
                        </span>
                      </span>
                      <span className={styles.qty}>
                        {formatDecimal(item.quantity)} <span className={styles.muted}>{item.unit}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <FormDrawer
        open={drawer.open}
        title={editing ? `Sửa: ${editing.name}` : 'Thêm món vào danh mục'}
        dirty={drawer.dirty}
        saving={drawer.saving}
        submitLabel="Lưu món"
        onClose={drawer.close}
        onSubmit={() => void drawer.submit()}
        footerExtra={
          editing ? (
            <Button danger type="text" onClick={() => void drawer.remove(editing.id, editing.name)}>
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
          <Form.Item label="Loại" name="kind">
            <Radio.Group
              optionType="button"
              options={(['vat_dung', 'nguyen_lieu'] as const).map((value) => ({
                value,
                label: INVENTORY_KIND_LABELS[value],
              }))}
            />
          </Form.Item>
          <Form.Item label="Tên món" name="name">
            <Input placeholder="VD: Ly thuỷ tinh cao, Sữa đặc" maxLength={80} />
          </Form.Item>
          <Form.Item label="Đơn vị" name="unit">
            <AutoComplete
              options={UNITS.map((value) => ({ value }))}
              filterOption={(input, option) => option?.value.startsWith(input.toLowerCase()) ?? false}
              placeholder="cái, chai, kg…"
            />
          </Form.Item>
          <Form.Item
            label="Số lượng hiện có"
            name="quantity"
            extra="Nhân viên đếm khác số này thì dòng báo đỏ và phải ghi lý do."
          >
            <InputNumber min={0} max={MAX_QUANTITY} decimalSeparator="," style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="Ghi chú cho nhân viên"
            name="note"
            extra="VD: để ở kệ trên quầy bar, đếm cả ly đang rửa."
          >
            <Input.TextArea rows={2} maxLength={200} />
          </Form.Item>
        </Form>
        {editing ? (
          <p className={styles.muted}>
            {used.length > 0 ? (
              <>
                Đang ở phiếu:{' '}
                {used.map((sheet) => (
                  <Tag key={sheet.id}>{sheet.name}</Tag>
                ))}
                Xoá món thì món rời khỏi các phiếu này.
              </>
            ) : (
              'Món chưa ở phiếu nào.'
            )}
          </p>
        ) : null}
      </FormDrawer>
    </>
  );
}

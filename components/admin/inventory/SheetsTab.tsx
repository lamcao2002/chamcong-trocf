'use client';

import { Button, Checkbox, Empty, Flex, Form, Input, Select, Tag } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { FormDrawer } from '@/components/common/FormDrawer';
import { useCrudDrawer } from '@/components/common/useCrudDrawer';
import { groupByKind, INVENTORY_KIND_LABELS } from '@/lib/domain/inventory';
import type { InventoryListView, InventorySheetView } from '@/lib/services/inventory';
import {
  inventorySheetSchema,
  type InventoryKind,
  type InventorySheetInput,
} from '@/lib/validation/inventory';
import styles from './inventory.module.css';

const kindCounts = (sheet: InventorySheetView) =>
  groupByKind(sheet.items)
    .map(({ label, rows }) => `${rows.length} ${label.toLowerCase()}`)
    .join(', ');

/** Phiếu kiểm kê: lấy món từ danh mục, chọn vị trí dùng phiếu; nhân viên vị trí đó thấy phiếu khi VÀO CA. */
export function SheetsTab({ list, onOpenCatalog }: { list: InventoryListView; onOpenCatalog: () => void }) {
  const { positions, items, sheets } = list;
  const drawer = useCrudDrawer<InventorySheetInput>({
    baseUrl: '/api/v1/inventory/sheets',
    schema: inventorySheetSchema,
    label: 'phiếu',
  });
  const editing = sheets.find(({ id }) => id === drawer.editingId);
  // Món trong phiếu không có ô nhập riêng nên phải bật `preserve` thì useWatch mới đọc được
  const itemIds = (Form.useWatch('itemIds', { form: drawer.form, preserve: true }) ?? []) as string[];
  const picked = itemIds.flatMap((id) => items.filter((item) => item.id === id));
  const left = items.filter(({ id }) => !itemIds.includes(id));
  const positionName = (id: string) => positions.find((row) => row.id === id)?.name ?? '?';

  const setItems = (next: string[]) => {
    drawer.form.setFieldValue('itemIds', next);
    drawer.form.setFields([{ name: 'itemIds', errors: [] }]);
    drawer.markDirty();
  };
  const move = (index: number, step: number) => {
    const next = [...itemIds];
    const [moved] = next.splice(index, 1);
    next.splice(index + step, 0, moved!);
    setItems(next);
  };
  const addKind = (kind: InventoryKind) =>
    setItems([...itemIds, ...left.filter((item) => item.kind === kind).map(({ id }) => id)]);

  const openSheet = (sheet: InventorySheetView) =>
    drawer.openWith(
      { name: sheet.name, positionIds: sheet.positionIds, itemIds: sheet.items.map(({ id }) => id) },
      sheet.id,
    );

  return (
    <>
      <div className={styles.filters}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => drawer.openWith({ name: '', positionIds: [], itemIds: [] })}
        >
          Tạo phiếu
        </Button>
      </div>
      <p className={styles.muted}>
        Mỗi phiếu là một nhóm món lấy từ danh mục, dành cho một hoặc nhiều vị trí. Nhân viên làm ca thuộc vị
        trí đó thấy phiếu khi đã VÀO CA, mỗi ca gửi mỗi phiếu một lần.
      </p>

      {sheets.length === 0 ? (
        <Empty description="Chưa có phiếu kiểm kê nào" />
      ) : (
        <ul className={styles.list}>
          {sheets.map((sheet) => (
            <li key={sheet.id}>
              <button
                type="button"
                className={styles.row}
                aria-label={`Sửa phiếu ${sheet.name}`}
                onClick={() => openSheet(sheet)}
              >
                <span className={styles.rowMain}>
                  <strong>{sheet.name}</strong>
                  <span className={styles.muted}>
                    {sheet.items.length > 0
                      ? `${sheet.items.length} món: ${kindCounts(sheet)}`
                      : 'Chưa có món'}
                  </span>
                  <span className={styles.chips}>
                    {sheet.positionIds.map((id) => (
                      <Tag key={id}>{positionName(id)}</Tag>
                    ))}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <FormDrawer
        open={drawer.open}
        title={editing ? `Sửa phiếu: ${editing.name}` : 'Tạo phiếu kiểm kê'}
        dirty={drawer.dirty}
        saving={drawer.saving}
        submitLabel="Lưu phiếu"
        onClose={drawer.close}
        onSubmit={() => void drawer.submit()}
        footerExtra={
          editing ? (
            <Button
              danger
              type="text"
              onClick={() => void drawer.remove(editing.id, `phiếu ${editing.name}`)}
            >
              Xoá phiếu
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
          <Form.Item label="Tên phiếu" name="name">
            <Input placeholder="VD: Nguyên liệu quầy bar, Dụng cụ phục vụ" maxLength={80} />
          </Form.Item>
          <Form.Item label="Dành cho vị trí" name="positionIds">
            <Checkbox.Group options={positions.map(({ id, name }) => ({ value: id, label: name }))} />
          </Form.Item>

          <Form.Item
            label={`Món trong phiếu (${picked.length})`}
            name="itemIds"
            extra="Nhân viên đếm theo thứ tự này."
          >
            <div>
              {picked.length === 0 ? <p className={styles.muted}>Chưa có món nào.</p> : null}
              <ul className={styles.sheetItems}>
                {picked.map((item, index) => (
                  <li key={item.id}>
                    <span className={styles.rowMain}>
                      <span>{item.name}</span>
                      <span className={styles.muted}>
                        {INVENTORY_KIND_LABELS[item.kind]} · {item.unit}
                      </span>
                    </span>
                    <Flex gap={4}>
                      <Button
                        size="small"
                        type="text"
                        icon={<ArrowUpOutlined />}
                        aria-label={`Đưa ${item.name} lên`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      />
                      <Button
                        size="small"
                        type="text"
                        icon={<ArrowDownOutlined />}
                        aria-label={`Đưa ${item.name} xuống`}
                        disabled={index === picked.length - 1}
                        onClick={() => move(index, 1)}
                      />
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<CloseOutlined />}
                        aria-label={`Bỏ ${item.name} khỏi phiếu`}
                        onClick={() => setItems(itemIds.filter((id) => id !== item.id))}
                      />
                    </Flex>
                  </li>
                ))}
              </ul>
            </div>
          </Form.Item>

          {items.length === 0 ? (
            <p className={styles.muted}>
              Danh mục chưa có món nào.{' '}
              <Button type="link" style={{ padding: 0 }} onClick={onOpenCatalog}>
                Mở Danh mục để thêm
              </Button>
            </p>
          ) : (
            <>
              <Select
                aria-label="Thêm món vào phiếu"
                placeholder={left.length > 0 ? 'Thêm món từ danh mục' : 'Đã thêm hết món trong danh mục'}
                disabled={left.length === 0}
                value={null}
                showSearch
                optionFilterProp="label"
                options={groupByKind(left).map(({ label, rows }) => ({
                  label,
                  options: rows.map(({ id, name, unit }) => ({ value: id, label: `${name} (${unit})` })),
                }))}
                onChange={(id: string | null) => {
                  if (id) setItems([...itemIds, id]);
                }}
                style={{ width: '100%' }}
              />
              <Flex gap={8} wrap style={{ marginTop: 8 }}>
                {(['vat_dung', 'nguyen_lieu'] as const).map((kind) => {
                  const rest = left.filter((item) => item.kind === kind).length;
                  return rest > 0 ? (
                    <Button key={kind} size="small" onClick={() => addKind(kind)}>
                      Thêm hết {INVENTORY_KIND_LABELS[kind].toLowerCase()} ({rest})
                    </Button>
                  ) : null;
                })}
              </Flex>
            </>
          )}
        </Form>
      </FormDrawer>
    </>
  );
}

import { useState } from 'react';
import { Keyboard, Modal, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { ScreenContainer, s } from '../../components/ui';
import { PickerLabel } from '../../components/ui/PickerLabel';
import { Dropdown } from '../../components/ui/Dropdown';
import { useFinance } from '../../hooks/finance';
import { CategoryManager } from '../categories/CategoryManager';
import {
  categoryPath,
  categoryTree,
} from '../../services/categories/hierarchy';
import { type CategoryAllocationDraft } from '../../services/accounting/split';
import type { CategoryType } from '../../types/finance';

export function TransactionCategoriesPicker({
  type,
  value,
  onChange,
  label = 'Danh mục',
}: {
  type: CategoryType;
  value: CategoryAllocationDraft[];
  onChange: (next: CategoryAllocationDraft[]) => void;
  label?: string;
}) {
  const { data, busy } = useFinance();
  const [adding, setAdding] = useState(false);
  const options = categoryTree(
    data.categories.filter(
      (c) =>
        c.type === type &&
        (!c.is_archived || value.some((row) => row.category === c.id)),
    ),
  ).map(({ category }) => ({
    value: category.id,
    label: categoryPath(data.categories, category.id),
    icon: category.icon,
  }));
  const select = (ids: string[]) => {
    if (busy) return;
    onChange(
      ids.map(
        (category) =>
          value.find((row) => row.category === category) ?? {
            id: randomUUID(),
            category,
            amount: '',
          },
      ),
    );
  };
  return (
    <View style={s.selectGroup}>
      <PickerLabel
        label={label}
        addLabel="Thêm danh mục mới"
        disabled={busy}
        onAdd={() => {
          Keyboard.dismiss();
          setAdding(true);
        }}
      />
      <Dropdown
        label={label}
        placeholder="Chọn danh mục"
        options={options}
        value={value[0]?.category ?? ''}
        onChange={(id) => select([id])}
      />
      <Modal
        visible={adding}
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setAdding(false);
        }}
      >
        <ScreenContainer
          title="Danh mục"
          scroll={false}
          onClose={() => setAdding(false)}
          closeDisabled={busy}
        >
          {adding && (
            <CategoryManager
              createOnly
              type={type}
              onClose={() => setAdding(false)}
              onSelect={(id) => {
                select([id]);
                setAdding(false);
              }}
            />
          )}
        </ScreenContainer>
      </Modal>
    </View>
  );
}

import { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { ScreenContainer, SecondaryButton, s } from '../../components/ui';
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
}: {
  type: CategoryType;
  value: CategoryAllocationDraft[];
  onChange: (next: CategoryAllocationDraft[]) => void;
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
    <View style={{ gap: 8 }}>
      <Text style={s.label}>Danh mục</Text>
      <Dropdown
        multiple
        label="Danh mục"
        placeholder="Chọn một hoặc nhiều danh mục"
        options={options}
        value={value.map((row) => row.category)}
        onChange={select}
      />
      <SecondaryButton
        label="Thêm danh mục mới"
        icon="add-outline"
        disabled={busy}
        onPress={() => setAdding(true)}
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
          subtitle={type === 'income' ? 'Thu nhập' : 'Chi tiêu'}
          scroll={false}
        >
          <CategoryManager
            type={type}
            onClose={() => setAdding(false)}
            onSelect={(id) => {
              if (!value.some((row) => row.category === id))
                select([...value.map((row) => row.category), id]);
              setAdding(false);
            }}
          />
        </ScreenContainer>
      </Modal>
    </View>
  );
}

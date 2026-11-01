import {
  categoryPath,
  categoryTree,
} from '../../services/categories/hierarchy';
import { useState } from 'react';
import { Keyboard, Modal, View } from 'react-native';
import { ScreenContainer, s } from '../../components/ui';
import { Dropdown } from '../../components/ui/Dropdown';
import { useFinance } from '../../hooks/finance';
import type { CategoryType } from '../../types/finance';
import { CategoryManager } from './CategoryManager';
import { PickerLabel } from '../../components/ui/PickerLabel';

export function TransactionCategoryPicker({
  type,
  value,
  onChange,
}: {
  type: CategoryType;
  value: string;
  onChange: (id: string) => void;
}) {
  const { data, busy } = useFinance();
  const [adding, setAdding] = useState(false);
  const options = categoryTree(
    data.categories.filter(
      (category) =>
        category.type === type &&
        (!category.is_archived || category.id === value),
    ),
  ).map(({ category }) => ({
    value: category.id,
    label: categoryPath(data.categories, category.id),
    icon: category.icon,
  }));
  return (
    <View style={s.selectGroup}>
      <PickerLabel
        label="Danh mục"
        addLabel="Thêm danh mục mới"
        disabled={busy}
        onAdd={() => {
          Keyboard.dismiss();
          setAdding(true);
        }}
      />
      <Dropdown
        label="Danh mục"
        placeholder="Chọn danh mục"
        options={options}
        value={value}
        onChange={(id) => {
          if (!busy) onChange(id);
        }}
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
                onChange(id);
                setAdding(false);
              }}
            />
          )}
        </ScreenContainer>
      </Modal>
    </View>
  );
}

import { useState } from 'react';
import { Keyboard, Modal, Pressable, Text, View } from 'react-native';
import { Icon, ScreenContainer, s } from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import type { CategoryType } from '../../types/finance';
import { CategoryManager } from './CategoryManager';

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
  const [open, setOpen] = useState(false);
  const selected = data.categories.find(
    (c) => c.id === value && !c.is_archived && c.type === type,
  );
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>Danh mục</Text>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={`Danh mục: ${selected?.name ?? 'Chọn danh mục'}`}
        accessibilityState={{ expanded: open, disabled: busy }}
        disabled={busy}
        style={[s.field, s.row]}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
      >
        {selected && <Icon name={selected.icon} color={selected.color} />}
        <Text style={[s.text, { flex: 1 }]} numberOfLines={2}>
          {selected?.name ?? 'Chọn danh mục'}
        </Text>
        <Icon name="chevron-down-outline" size={18} />
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <ScreenContainer
          title="Danh mục"
          subtitle={type === 'expense' ? 'Chi tiêu' : 'Thu nhập'}
          scroll={false}
        >
          <CategoryManager
            key={type}
            type={type}
            value={value}
            onClose={() => setOpen(false)}
            onSelect={(id) => {
              onChange(id);
              setOpen(false);
            }}
          />
        </ScreenContainer>
      </Modal>
    </View>
  );
}

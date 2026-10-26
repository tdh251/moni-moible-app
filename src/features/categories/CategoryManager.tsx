import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import {
  ConfirmationDialog,
  Field,
  Icon,
  PrimaryButton,
  SecondaryButton,
  s,
} from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import type { Category, CategoryType } from '../../types/finance';
import { colors } from '../../theme';
import { CategoryList } from './CategoryList';

const icons = [
  'restaurant-outline',
  'basket-outline',
  'home-outline',
  'bus-outline',
  'bag-outline',
  'game-controller-outline',
  'medkit-outline',
  'receipt-outline',
  'briefcase-outline',
  'gift-outline',
  'wallet-outline',
  'ellipsis-horizontal-outline',
];
const palette = [
  '#287D68',
  '#B76553',
  '#D4A457',
  '#648DAB',
  '#9B7FA7',
  '#729B84',
];

export function CategoryManager({
  type,
  value,
  onSelect,
  onClose,
}: {
  type: CategoryType;
  value?: string;
  onSelect?: (id: string) => void;
  onClose?: () => void;
}) {
  const { data, mutate, busy } = useFinance();
  const [draft, setDraft] = useState<Category | null>(null);
  const list = data.categories.filter((c) => c.type === type);
  const visible = onSelect ? list.filter((c) => !c.is_archived) : list;
  const exists = draft && data.categories.some((c) => c.id === draft.id);
  const save = async () => {
    if (draft && (await mutate((repo) => repo.saveCategory(draft)))) {
      setDraft(null);
      if (!exists) onSelect?.(draft.id);
    }
  };
  const archive = async () => {
    if (!draft || busy) return;
    if (
      await ConfirmationDialog(
        draft.is_archived ? 'Khôi phục danh mục?' : 'Lưu trữ danh mục?',
        'Lịch sử và số liệu cũ được giữ nguyên.',
      )
    ) {
      if (
        await mutate((repo) =>
          repo.saveCategory({
            ...draft,
            is_archived: draft.is_archived ? 0 : 1,
          }),
        )
      )
        setDraft(null);
    }
  };
  const remove = async () => {
    if (!draft || busy) return;
    const used =
      data.transactions.some((t) => t.category_id === draft.id) ||
      data.items.some((i) => i.category_id === draft.id);
    if (
      await ConfirmationDialog(
        'Xóa danh mục?',
        used
          ? 'Danh mục đã có giao dịch sẽ được lưu trữ và ẩn khỏi danh sách chọn. Lịch sử và số liệu cũ được giữ nguyên.'
          : `Xóa danh mục “${draft.name}”?`,
        true,
      )
    ) {
      if (await mutate((repo) => repo.deleteCategory(draft.id))) setDraft(null);
    }
  };
  if (draft)
    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 18, paddingBottom: 24 }}
      >
        <Text style={s.heading}>
          {exists ? 'Sửa danh mục' : 'Thêm danh mục'}
        </Text>
        <Text style={s.muted}>
          {type === 'expense' ? 'Chi tiêu' : 'Thu nhập'}
        </Text>
        <Field
          label="Tên danh mục"
          value={draft.name}
          onChangeText={(name) => setDraft({ ...draft, name })}
          maxLength={100}
          editable={!busy}
        />
        <Text style={s.label}>Biểu tượng</Text>
        <View style={s.wrap}>
          {icons.map((icon) => (
            <Pressable
              key={icon}
              accessibilityRole="button"
              accessibilityLabel={icon}
              accessibilityState={{ selected: draft.icon === icon }}
              disabled={busy}
              style={[s.pill, draft.icon === icon && s.selected]}
              onPress={() => setDraft({ ...draft, icon })}
            >
              <Icon name={icon} />
            </Pressable>
          ))}
        </View>
        <Text style={s.label}>Màu sắc</Text>
        <View style={s.wrap}>
          {palette.map((color) => (
            <Pressable
              key={color}
              accessibilityRole="button"
              accessibilityLabel={color}
              accessibilityState={{ selected: draft.color === color }}
              disabled={busy}
              onPress={() => setDraft({ ...draft, color })}
              style={[
                s.pill,
                {
                  backgroundColor: color,
                  borderWidth: draft.color === color ? 3 : 0,
                  borderColor: colors.text,
                  width: 45,
                  height: 45,
                },
              ]}
            />
          ))}
        </View>
        <PrimaryButton
          label="Lưu danh mục"
          disabled={busy}
          onPress={() => void save()}
        />
        {exists && (
          <>
            <SecondaryButton
              label={
                draft.is_archived ? 'Khôi phục danh mục' : 'Lưu trữ danh mục'
              }
              disabled={busy}
              onPress={() => void archive()}
            />
            <SecondaryButton
              label="Xóa danh mục"
              icon="trash-outline"
              danger
              disabled={busy}
              onPress={() => void remove()}
            />
          </>
        )}
        <SecondaryButton
          label="Quay lại danh sách"
          disabled={busy}
          onPress={() => setDraft(null)}
        />
      </ScrollView>
    );
  return (
    <View style={{ flex: 1, gap: 12 }}>
      <Text style={s.muted}>Kéo biểu tượng ☰ để sắp xếp danh mục.</Text>
      <CategoryList
        categories={visible}
        busy={busy}
        value={value}
        onSelect={onSelect}
        onEdit={(c) => setDraft({ ...c })}
        onReorder={(ids) =>
          mutate((repo) =>
            repo.reorderCategories(
              type,
              onSelect
                ? [
                    ...ids,
                    ...list.filter((c) => c.is_archived).map((c) => c.id),
                  ]
                : ids,
            ),
          )
        }
      />
      <PrimaryButton
        label="Thêm danh mục"
        icon="add-outline"
        disabled={busy}
        onPress={() =>
          setDraft({
            id: randomUUID(),
            name: '',
            type,
            icon: type === 'expense' ? 'basket-outline' : 'wallet-outline',
            color: colors.primary,
            sort_order: 0,
            is_archived: 0,
          })
        }
      />
      {onClose && (
        <SecondaryButton label="Đóng" disabled={busy} onPress={onClose} />
      )}
    </View>
  );
}

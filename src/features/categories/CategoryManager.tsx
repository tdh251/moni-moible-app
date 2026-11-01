import { CategoryAppearancePicker } from './CategoryAppearancePicker';
import { transactionCategoryTags } from '../../services/categories/tags';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import {
  ConfirmationDialog,
  Field,
  PrimaryButton,
  SecondaryButton,
  s,
} from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import type { Category, CategoryType } from '../../types/finance';
import { colors } from '../../theme';
import { CategoryList } from './CategoryList';

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
  const create = () =>
    setDraft({
      id: randomUUID(),
      name: '',
      type,
      parent_id: null,
      icon: type === 'expense' ? 'basket-outline' : 'wallet-outline',
      color: colors.primary,
      sort_order: 0,
      is_archived: 0,
    });
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
        'Lưu trữ sẽ ẩn danh mục khỏi danh sách chọn. Lịch sử và số liệu cũ được giữ nguyên.',
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
      data.transactions.some(
        (t) =>
          t.category_id === draft.id ||
          transactionCategoryTags(t).includes(draft.id),
      ) || data.items.some((i) => i.category_id === draft.id);
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
        <CategoryAppearancePicker
          key={draft.id}
          name={draft.name}
          icon={draft.icon}
          color={draft.color}
          disabled={busy}
          onIconChange={(icon) => setDraft({ ...draft, icon })}
          onColorChange={(color) => setDraft({ ...draft, color })}
        />
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
      <Text style={s.muted}>
        Giữ danh mục khoảng 0,4 giây rồi kéo để đổi thứ tự. Viền xanh cho biết
        danh mục đang được kéo.
      </Text>
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
        onPress={() => create()}
      />
      {onClose && (
        <SecondaryButton label="Đóng" disabled={busy} onPress={onClose} />
      )}
    </View>
  );
}

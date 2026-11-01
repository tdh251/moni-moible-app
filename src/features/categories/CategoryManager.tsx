import { EditorHeading } from '../../components/ui/EditorHeading';
import { FormActions } from '../../components/ui/FormActions';
import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { useScrollAddButton } from '../../hooks/useScrollAddButton';
import { CategoryAppearancePicker } from './CategoryAppearancePicker';
import {
  itemCategoryIds,
  transactionCategoryTags,
} from '../../services/categories/tags';
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

function newCategory(type: CategoryType): Category {
  return {
    id: randomUUID(),
    name: '',
    type,
    parent_id: null,
    icon: type === 'expense' ? 'basket-outline' : 'wallet-outline',
    color: colors.primary,
    sort_order: 0,
    is_archived: 0,
  };
}

export function CategoryManager({
  type,
  value,
  onSelect,
  onClose,
  floatingAdd = false,
  createOnly = false,
  onEditingChange,
}: {
  type: CategoryType;
  value?: string;
  onSelect?: (id: string) => void;
  onClose?: () => void;
  floatingAdd?: boolean;
  createOnly?: boolean;
  onEditingChange?: (editing: boolean) => void;
}) {
  const { data, mutate, busy } = useFinance();
  const { addButtonVisible, handleScroll, resetScroll } = useScrollAddButton();
  const [draft, setDraftState] = useState<Category | null>(() =>
    createOnly ? newCategory(type) : null,
  );
  const setDraft = (value: Category | null) => {
    setDraftState(value);
    onEditingChange?.(
      !!value && data.categories.some((row) => row.id === value.id),
    );
  };
  const list = data.categories.filter((c) => c.type === type);
  const visible = onSelect ? list.filter((c) => !c.is_archived) : list;
  const exists = draft && data.categories.some((c) => c.id === draft.id);
  const create = () => {
    resetScroll();
    setDraft(newCategory(type));
  };
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
      ) || data.items.some((i) => itemCategoryIds(i).includes(draft.id));
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
        {!createOnly && (
          <>
            <EditorHeading
              title={exists ? 'Sửa danh mục' : 'Thêm danh mục'}
              archiveLabel={
                draft.is_archived ? 'Khôi phục danh mục' : 'Lưu trữ danh mục'
              }
              deleteLabel="Xóa danh mục"
              archived={!!draft.is_archived}
              disabled={busy}
              onArchive={exists ? () => void archive() : undefined}
              onDelete={exists ? () => void remove() : undefined}
            />
            <Text style={s.muted}>
              {type === 'expense' ? 'Chi tiêu' : 'Thu nhập'}
            </Text>
          </>
        )}
        <Field
          label="Tên danh mục"
          value={draft.name}
          onChangeText={(name) => setDraft({ ...draft, name })}
          maxLength={100}
          editable={!busy}
        />
        <CategoryAppearancePicker
          searchable={!createOnly}
          key={draft.id}
          name={draft.name}
          icon={draft.icon}
          color={draft.color}
          disabled={busy}
          onIconChange={(icon) => setDraft({ ...draft, icon })}
          onColorChange={(color) => setDraft({ ...draft, color })}
        />
        {!createOnly && (
          <PrimaryButton
            label="Lưu"
            disabled={busy}
            onPress={() => void save()}
          />
        )}
        {createOnly && (
          <FormActions
            busy={busy}
            onCancel={() => onClose?.()}
            onSave={() => void save()}
          />
        )}
      </ScrollView>
    );
  return (
    <>
      <View style={{ flex: 1, gap: 12 }}>
        <Text style={s.muted}>
          Giữ danh mục khoảng 0,4 giây rồi kéo để đổi thứ tự. Viền xanh cho biết
          danh mục đang được kéo.
        </Text>
        <CategoryList
          categories={visible}
          onScroll={floatingAdd ? handleScroll : undefined}
          bottomPadding={floatingAdd ? 96 : 4}
          busy={busy}
          value={value}
          onSelect={onSelect}
          onEdit={(c) => {
            resetScroll();
            setDraft({ ...c });
          }}
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
        {!floatingAdd && (
          <PrimaryButton
            label="Thêm danh mục"
            icon="add-outline"
            disabled={busy}
            onPress={() => create()}
          />
        )}
        {onClose && (
          <SecondaryButton label="Đóng" disabled={busy} onPress={onClose} />
        )}
      </View>
      {floatingAdd && (
        <FloatingAddButton
          visible={addButtonVisible}
          label="Thêm danh mục"
          hint="Mở biểu mẫu thêm danh mục"
          disabled={busy}
          onPress={create}
        />
      )}
    </>
  );
}

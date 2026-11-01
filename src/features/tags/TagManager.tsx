import { EditorHeading } from '../../components/ui/EditorHeading';
import { FormActions } from '../../components/ui/FormActions';
import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { useScrollAddButton } from '../../hooks/useScrollAddButton';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import {
  Choices,
  ConfirmationDialog,
  EmptyState,
  Field,
  Icon,
  PrimaryButton,
  SecondaryButton,
  s,
} from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import type { Tag } from '../../types/finance';
import { categoryPalette, normalizeIconSearch } from '../categories/appearance';
import { transactionTagIds } from '../../services/tags';
import { colors } from '../../theme';

function newTag(): Tag {
  return { id: randomUUID(), name: '', color: colors.primary, is_archived: 0 };
}

export function TagManager({
  onSelect,
  onClose,
  floatingAdd = false,
  createOnly = false,
  onEditingChange,
}: {
  onSelect?: (id: string) => void;
  onClose?: () => void;
  floatingAdd?: boolean;
  createOnly?: boolean;
  onEditingChange?: (editing: boolean) => void;
}) {
  const { data, mutate, busy } = useFinance();
  const { addButtonVisible, handleScroll, resetScroll } = useScrollAddButton();
  const [draft, setDraftState] = useState<Tag | null>(() =>
    createOnly ? newTag() : null,
  );
  const setDraft = (value: Tag | null) => {
    setDraftState(value);
    onEditingChange?.(
      !!value && (data.tags ?? []).some((row) => row.id === value.id),
    );
  };
  const edit = (tag: Tag) => {
    resetScroll();
    setDraft({ ...tag });
  };
  const create = () => {
    resetScroll();
    setDraft(newTag());
  };
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState<'active' | 'all'>('active');
  const exists = draft && (data.tags ?? []).some((t) => t.id === draft.id);
  const save = async () => {
    if (draft && (await mutate((repo) => repo.saveTag(draft)))) {
      setDraft(null);
      if (!exists) onSelect?.(draft.id);
    }
  };
  const archive = async () => {
    if (!draft || busy) return;
    if (
      await mutate((repo) =>
        repo.saveTag({ ...draft, is_archived: draft.is_archived ? 0 : 1 }),
      )
    )
      setDraft(null);
  };
  const remove = async () => {
    if (!draft || busy) return;
    const used = [...data.transactions, ...data.items].some((row) =>
      transactionTagIds(row).includes(draft.id),
    );
    if (
      await ConfirmationDialog(
        'Xóa tag?',
        used
          ? 'Tag đã được dùng sẽ được lưu trữ. Lịch sử giao dịch và thống kê vẫn được giữ.'
          : `Xóa tag “${draft.name}”?`,
        true,
      )
    ) {
      if (await mutate((repo) => repo.deleteTag(draft.id))) setDraft(null);
    }
  };
  if (draft)
    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
      >
        {!createOnly && (
          <EditorHeading
            title={exists ? 'Sửa tag' : 'Thêm tag'}
            archiveLabel={draft.is_archived ? 'Khôi phục tag' : 'Lưu trữ tag'}
            deleteLabel="Xóa tag"
            archived={!!draft.is_archived}
            disabled={busy}
            onArchive={exists ? () => void archive() : undefined}
            onDelete={exists ? () => void remove() : undefined}
          />
        )}
        <View
          style={[
            s.row,
            {
              padding: 14,
              borderRadius: 16,
              backgroundColor: `${draft.color}18`,
            },
          ]}
        >
          <Icon name="pricetag-outline" color={draft.color} />
          <Text style={s.text}>{draft.name.trim() || 'Tag của bạn'}</Text>
        </View>
        <Field
          label="Tên tag"
          placeholder="Ví dụ: Shopee, Tết, Khuyến mãi"
          value={draft.name}
          onChangeText={(name) => setDraft({ ...draft, name })}
          maxLength={50}
          editable={!busy}
        />
        <Text style={s.label}>Màu tag · 10 lựa chọn</Text>
        <View style={[s.wrap, { gap: 0 }]}>
          {categoryPalette.map((item) => (
            <View
              key={item.color}
              style={{ width: '20%', padding: 4, alignItems: 'center' }}
            >
              <Pressable
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Màu ${item.label}`}
                accessibilityState={{
                  selected: draft.color.toUpperCase() === item.color,
                  disabled: busy,
                }}
                onPress={() => setDraft({ ...draft, color: item.color })}
                style={{
                  width: '100%',
                  maxWidth: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor:
                    draft.color.toUpperCase() === item.color
                      ? colors.text
                      : 'transparent',
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: item.color,
                  }}
                />
              </Pressable>
            </View>
          ))}
        </View>
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
  const shown = (data.tags ?? []).filter(
    (t) =>
      (visibility === 'all' || !t.is_archived) &&
      normalizeIconSearch(t.name).includes(normalizeIconSearch(search)),
  );
  const counts = new Map<string, number>();
  const linked = new Map(
    data.transactions.map((tx) => [tx.id, new Set(transactionTagIds(tx))]),
  );
  for (const item of data.items)
    for (const id of transactionTagIds(item))
      linked.get(item.transaction_id)?.add(id);
  for (const ids of linked.values())
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return (
    <>
      <View style={{ flex: 1, gap: 12 }}>
        <Field
          label="Tìm tag"
          placeholder="Nhập tên tag"
          value={search}
          onChangeText={setSearch}
        />
        <Choices
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: 'active', label: 'Đang dùng' },
            { value: 'all', label: 'Tất cả' },
          ]}
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: floatingAdd ? 96 : 0 }}
          onScroll={floatingAdd ? handleScroll : undefined}
          scrollEventThrottle={16}
        >
          {!shown.length && (
            <EmptyState
              title="Chưa có tag phù hợp"
              description="Thêm tag để nhóm giao dịch theo cửa hàng, dịp hoặc mục đích của bạn."
            />
          )}
          {shown.map((tag) => (
            <View
              key={tag.id}
              style={[
                s.row,
                {
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderColor: colors.border,
                },
              ]}
            >
              <Pressable
                style={[s.row, { flex: 1, minHeight: 48 }]}
                disabled={busy || (!!onSelect && !!tag.is_archived)}
                accessibilityRole="button"
                accessibilityLabel={`${onSelect ? 'Chọn' : 'Sửa'} tag ${tag.name}`}
                onPress={() => (onSelect ? onSelect(tag.id) : edit(tag))}
              >
                <Icon name="pricetag-outline" color={tag.color} />
                <View style={{ flex: 1 }}>
                  <Text style={s.text}>{tag.name}</Text>
                  <Text style={s.muted}>
                    {counts.get(tag.id) ?? 0} giao dịch
                    {tag.is_archived ? ' · Đã lưu trữ' : ''}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Sửa tag ${tag.name}`}
                style={{ padding: 12 }}
                onPress={() => edit(tag)}
              >
                <Icon name="create-outline" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
        {!floatingAdd && (
          <PrimaryButton
            label="Thêm tag"
            icon="add-outline"
            disabled={busy}
            onPress={create}
          />
        )}
        {onClose && (
          <SecondaryButton label="Đóng" disabled={busy} onPress={onClose} />
        )}
      </View>
      {floatingAdd && (
        <FloatingAddButton
          visible={addButtonVisible}
          label="Thêm tag"
          hint="Mở biểu mẫu thêm tag"
          disabled={busy}
          onPress={create}
        />
      )}
    </>
  );
}

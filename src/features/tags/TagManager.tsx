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

export function TagManager({
  onSelect,
  onClose,
}: {
  onSelect?: (id: string) => void;
  onClose?: () => void;
}) {
  const { data, mutate, busy } = useFinance();
  const [draft, setDraft] = useState<Tag | null>(null);
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
    const used = data.transactions.some((t) =>
      transactionTagIds(t).includes(draft.id),
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
        <Text style={s.heading}>{exists ? 'Sửa tag' : 'Thêm tag'}</Text>
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
        <Text style={s.label}>Màu tag</Text>
        <View style={[s.wrap, { gap: 8 }]}>
          {categoryPalette.map((item) => (
            <Pressable
              key={item.color}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Màu ${item.label}`}
              accessibilityState={{
                selected: draft.color.toUpperCase() === item.color,
                disabled: busy,
              }}
              onPress={() => setDraft({ ...draft, color: item.color })}
              style={{
                width: 48,
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
          ))}
        </View>
        <PrimaryButton
          label="Lưu tag"
          disabled={busy}
          onPress={() => void save()}
        />
        {exists && (
          <>
            <SecondaryButton
              label={draft.is_archived ? 'Khôi phục tag' : 'Lưu trữ tag'}
              disabled={busy}
              onPress={() => void archive()}
            />
            <SecondaryButton
              label="Xóa tag"
              icon="trash-outline"
              danger
              disabled={busy}
              onPress={() => void remove()}
            />
          </>
        )}
        <SecondaryButton
          label="Quay lại danh sách tag"
          disabled={busy}
          onPress={() => setDraft(null)}
        />
      </ScrollView>
    );
  const shown = (data.tags ?? []).filter(
    (t) =>
      (visibility === 'all' || !t.is_archived) &&
      normalizeIconSearch(t.name).includes(normalizeIconSearch(search)),
  );
  const counts = new Map<string, number>();
  for (const tx of data.transactions)
    for (const id of transactionTagIds(tx))
      counts.set(id, (counts.get(id) ?? 0) + 1);
  return (
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
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
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
              onPress={() =>
                onSelect ? onSelect(tag.id) : setDraft({ ...tag })
              }
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
              onPress={() => setDraft({ ...tag })}
            >
              <Icon name="create-outline" />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <PrimaryButton
        label="Thêm tag"
        icon="add-outline"
        disabled={busy}
        onPress={() =>
          setDraft({
            id: randomUUID(),
            name: '',
            color: colors.primary,
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

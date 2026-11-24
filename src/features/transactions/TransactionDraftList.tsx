import { FlatList, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  Amount,
  AppCard,
  ConfirmationDialog,
  EmptyState,
  s,
} from '../../components/ui';
import { StatusBadge } from '../../components/ui/primitives';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { MotionPressable } from '../../components/ui/MotionPressable';
import { useFinance } from '../../hooks/finance';
import { typeNames } from '../../utils/format';
import type { SavedTransactionDraft } from '../../types/transaction-draft';

export function TransactionDraftList({
  bottomPadding = 24,
}: {
  bottomPadding?: number;
}) {
  const { data, mutate, busy } = useFinance();
  const remove = async (draft: SavedTransactionDraft) => {
    if (busy) return;
    if (
      await ConfirmationDialog(
        'Xóa bản nháp?',
        `Xóa bản nháp “${draft.values.title.trim() || 'Trống'}”? Giao dịch gốc vẫn được giữ nguyên.`,
        true,
      )
    )
      await mutate((repo) => repo.deleteTransactionDraft(draft.id));
  };
  return (
    <FlatList
      style={{ flex: 1 }}
      data={data.transactionDrafts ?? []}
      keyExtractor={(draft) => draft.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingBottom: bottomPadding }}
      renderItem={({ item: draft }) => (
        <AppCard>
          <View style={s.between}>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel={`Mở bản nháp ${draft.values.title.trim() || 'Trống'}`}
              disabled={busy}
              style={{ flex: 1, gap: 6, minHeight: 48 }}
              onPress={() =>
                router.push({
                  pathname: '/transaction/drafts/[id]',
                  params: { id: draft.id },
                })
              }
            >
              <StatusBadge
                label={`Bản nháp · ${typeNames[draft.values.type]}`}
                tone="brand"
              />
              <Text style={s.heading} numberOfLines={2}>
                {draft.values.title.trim() || 'Trống'}
              </Text>
              <Text style={s.muted}>
                Cập nhật {new Date(draft.updated_at).toLocaleString('vi-VN')}
              </Text>
              {draft.values.mode === 'items' ? (
                <Text style={s.muted}>
                  Hóa đơn · {draft.values.items.length} mục chi
                </Text>
              ) : /^\d+$/.test(draft.values.amount) &&
                Number.isSafeInteger(Number(draft.values.amount)) ? (
                <Amount value={Number(draft.values.amount)} />
              ) : (
                <Text style={s.muted}>Chưa nhập số tiền hợp lệ</Text>
              )}
            </MotionPressable>
            <ActionMenu
              label={`Thao tác bản nháp ${draft.values.title.trim() || 'Trống'}`}
              disabled={busy}
              actions={[
                {
                  label: 'Xóa bản nháp',
                  icon: 'trash-outline',
                  danger: true,
                  onPress: () => void remove(draft),
                },
              ]}
            />
          </View>
        </AppCard>
      )}
      ListEmptyComponent={
        <EmptyState
          title="Chưa có bản nháp"
          description="Mở một giao dịch đã tạo → menu ⋯ → Nhân bản thành bản nháp."
          icon="documents-outline"
        />
      }
    />
  );
}

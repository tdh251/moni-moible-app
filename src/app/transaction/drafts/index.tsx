import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  Amount,
  AppCard,
  ConfirmationDialog,
  EmptyState,
  IconButton,
  ScreenContainer,
  s,
} from '../../../components/ui';
import { useFinance } from '../../../hooks/finance';
import { typeNames } from '../../../utils/format';
import { colors } from '../../../theme';
import type { SavedTransactionDraft } from '../../../types/transaction-draft';

export default function TransactionDrafts() {
  const { data, mutate, busy } = useFinance();
  const drafts = data.transactionDrafts ?? [];
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
    <ScreenContainer
      title={`Bản nháp (${drafts.length})`}
      subtitle="Chưa tính vào số dư và thống kê. Mở bản nháp để chỉnh sửa hoặc ghi giao dịch."
      back
      scroll={false}
    >
      <FlatList
        data={drafts}
        keyExtractor={(draft) => draft.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        renderItem={({ item: draft }) => (
          <AppCard>
            <View style={s.between}>
              <Pressable
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
                <Text style={[s.muted, { color: colors.primary }]}>
                  Bản nháp · {typeNames[draft.values.type]}
                </Text>
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
              </Pressable>
              <IconButton
                label={`Xóa bản nháp ${draft.values.title.trim() || 'Trống'}`}
                icon="trash-outline"
                danger
                disabled={busy}
                onPress={() => void remove(draft)}
              />
            </View>
          </AppCard>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Chưa có bản nháp"
            description="Mở một giao dịch đã tạo và chọn Nhân bản thành bản nháp."
            icon="documents-outline"
          />
        }
      />
    </ScreenContainer>
  );
}

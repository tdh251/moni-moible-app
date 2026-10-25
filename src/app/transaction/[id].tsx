import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Amount,
  AppCard,
  ConfirmationDialog,
  EmptyState,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  s,
} from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import { typeNames } from '../../utils/format';
import { colors } from '../../theme';
import {
  calculateReceipt,
  parseAdjustments,
  adjustmentLabel,
} from '../../services/accounting/receipt';
export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, mutate, busy } = useFinance();
  const t = data.transactions.find((x) => x.id === id);
  if (!t)
    return (
      <ScreenContainer title="Giao dịch" back>
        <EmptyState
          title="Không tìm thấy giao dịch"
          description="Giao dịch có thể đã được xóa."
        />
      </ScreenContainer>
    );
  const items = data.items.filter((i) => i.transaction_id === id);
  const receipt = items.length
    ? calculateReceipt(items, parseAdjustments(t.adjustments_json))
    : null;
  const name = (accountId: string | null) =>
    data.accounts.find((a) => a.id === accountId)?.name ?? '';
  const category = (categoryId: string | null) =>
    data.categories.find((c) => c.id === categoryId)?.name ?? '';
  const remove = async () => {
    if (
      await ConfirmationDialog(
        'Xóa giao dịch?',
        `“${t.title}” sẽ bị xóa và số dư được tính lại. Thao tác có thể bị từ chối nếu làm âm số dư lịch sử.`,
        true,
      )
    ) {
      if (await mutate((repo) => repo.deleteTransaction(id))) router.back();
    }
  };
  return (
    <ScreenContainer title="Chi tiết giao dịch" back>
      <AppCard>
        <Text style={s.muted}>{typeNames[t.type]}</Text>
        <Text style={s.title}>{t.title}</Text>
        <Amount
          value={t.amount}
          style={{
            fontSize: 30,
            lineHeight: 42,
            color: t.type === 'expense' ? colors.expense : colors.primary,
          }}
        />
        {t.exclude_from_balance === 1 && (
          <Text style={[s.muted, { color: colors.primary }]}>
            Không tính vào số dư · vẫn tính vào thống kê thu/chi
          </Text>
        )}
        <Text style={s.text}>
          {new Date(t.occurred_at).toLocaleString('vi-VN')}
        </Text>
        {t.source_account_id && (
          <Text style={s.text}>Từ: {name(t.source_account_id)}</Text>
        )}
        {t.destination_account_id && (
          <Text style={s.text}>Đến: {name(t.destination_account_id)}</Text>
        )}
        {t.category_id && (
          <Text style={s.text}>Danh mục: {category(t.category_id)}</Text>
        )}
        {!!t.note && <Text style={s.text}>{t.note}</Text>}
        {t.type === 'transfer' && (
          <Text style={s.muted}>
            Chuyển nội bộ không ảnh hưởng tổng tài sản, thu nhập hoặc chi tiêu.
          </Text>
        )}
      </AppCard>
      {!!items.length && (
        <AppCard>
          <Text style={s.heading}>Hóa đơn · {items.length} mục</Text>
          {items.map((i) => (
            <View key={i.id} style={s.between}>
              <View style={{ flex: 1 }}>
                <Text style={s.text}>{i.name}</Text>
                <Text style={s.muted}>{category(i.category_id)}</Text>
              </View>
              <Amount value={i.amount} />
            </View>
          ))}
          {receipt && (
            <>
              <View style={s.divider} />
              <View style={s.between}>
                <Text style={s.text}>Tạm tính</Text>
                <Amount value={receipt.subtotal} />
              </View>
              {receipt.lines.map((line) => (
                <View key={line.id} style={s.between}>
                  <Text style={[s.text, { flex: 1 }]}>
                    {adjustmentLabel(line)}
                  </Text>
                  <Amount value={line.amount} />
                </View>
              ))}
              <View style={s.between}>
                <Text style={s.heading}>Tổng thanh toán</Text>
                <Amount value={receipt.total} />
              </View>
              {receipt.lines.length > 0 && (
                <Text style={s.muted}>
                  Thống kê phân bổ tổng sau điều chỉnh theo tỷ trọng tiền của
                  từng mục.
                </Text>
              )}
            </>
          )}
        </AppCard>
      )}
      <PrimaryButton
        label="Sửa giao dịch"
        disabled={busy}
        onPress={() =>
          router.push({ pathname: '/transaction/edit/[id]', params: { id } })
        }
      />
      <SecondaryButton
        label="Xóa giao dịch"
        danger
        disabled={busy}
        onPress={() => void remove()}
      />
    </ScreenContainer>
  );
}

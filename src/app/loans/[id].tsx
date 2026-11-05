import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Amount,
  AppCard,
  ConfirmationDialog,
  EmptyState,
  ScreenContainer,
  Icon,
  s,
} from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import { LoanReminderCard } from '../../features/loans/LoanReminderCard';
import { LoanPaymentHistory } from '../../features/loans/LoanPaymentHistory';
import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { colors } from '../../theme';
import {
  loanOutstanding,
  parseLoanCosts,
  totalLoanCosts,
  loanTotalAmount,
  loanMonthlyPayment,
} from '../../services/loans';
export default function LoanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, mutate, busy } = useFinance();
  const loan = data.loans?.find((loan) => loan.id === id);
  if (!loan)
    return (
      <ScreenContainer title="Khoản vay" back>
        <EmptyState
          title="Không tìm thấy khoản vay"
          description="Vui lòng quay lại danh sách."
        />
      </ScreenContainer>
    );
  const payments = (data.loanPayments ?? []).filter((p) => p.loan_id === id);
  const lending = loan.direction === 'lend';
  const remaining = loanOutstanding(loan, payments);
  const costs = parseLoanCosts(loan);
  const monthly = loanMonthlyPayment(loan);
  const account = data.accounts.find((a) => a.id === loan.account_id);
  const remove = async () => {
    if (
      await ConfirmationDialog(
        lending ? 'Xóa khoản cho vay?' : 'Xóa khoản vay?',
        lending
          ? 'Khoản cho vay và các lần thu hồi sẽ được xóa. Số dư các tài khoản liên quan được tính lại. Chỉ dùng khi ghi nhầm khoản cho vay.'
          : 'Khoản vay và các lần trả nợ sẽ được xóa. Số dư các tài khoản liên quan được tính lại. Chỉ dùng khi ghi nhầm khoản vay.',
      )
    ) {
      if (await mutate((repo) => repo.deleteLoan(id))) router.back();
    }
  };
  return (
    <ScreenContainer
      title={loan.lender}
      subtitle={lending ? 'Chi tiết cho vay' : 'Chi tiết khoản vay'}
      floatingAction={
        remaining > 0 ? (
          <FloatingAddButton
            visible
            label={lending ? 'Thu hồi tiền' : 'Trả nợ'}
            hint={
              lending
                ? 'Ghi nhận lần thu hồi khoản cho vay'
                : 'Ghi nhận lần trả nợ'
            }
            disabled={busy}
            onPress={() =>
              router.push({ pathname: '/loans/repay/[id]', params: { id } })
            }
          />
        ) : undefined
      }
      rightAction={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={lending ? 'Xóa khoản cho vay' : 'Xóa khoản vay'}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void remove()}
          style={({ pressed }) => ({
            minWidth: 48,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: busy ? 0.45 : pressed ? 0.7 : 1,
          })}
        >
          <Icon name="trash-outline" color={colors.expense} />
        </Pressable>
      }
      back
    >
      <AppCard style={{ backgroundColor: colors.balance }}>
        <View style={[s.between, { flexWrap: 'wrap' }]}>
          <Text style={[s.heading, { flexShrink: 1, color: colors.card }]}>
            Cần thanh toán
          </Text>
          <View
            style={{
              alignSelf: 'flex-end',
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor:
                remaining > 0 ? colors.expenseLight : colors.light,
            }}
          >
            <Text
              accessibilityLabel={`Trạng thái: ${remaining > 0 ? (lending ? 'Cần thu hồi' : 'Còn nợ') : 'Đã tất toán'}`}
              style={{
                color: remaining > 0 ? colors.expense : colors.primary,
                fontSize: 13,
                fontWeight: '600',
              }}
            >
              {remaining > 0
                ? lending
                  ? 'Cần thu hồi'
                  : 'Còn nợ'
                : 'Đã tất toán'}
            </Text>
          </View>
        </View>
        <Amount
          value={remaining}
          style={{ fontSize: 30, lineHeight: 42, color: colors.card }}
        />
        <View style={[s.divider, { backgroundColor: '#FFFFFF30' }]} />
        {monthly && (
          <>
            <View style={s.between}>
              <Text style={[s.muted, { flex: 1, color: colors.light }]}>
                {lending ? 'Trung bình cần thu mỗi tháng' : 'Cần trả mỗi tháng'}
              </Text>
              <Amount value={monthly.amount} style={{ color: colors.card }} />
            </View>
            {lending && (
              <Text style={[s.muted, { color: colors.light }]}>
                Tổng khoản vay chia đều cho {monthly.months} tháng, làm tròn lên
                theo VND. Phần tháng lẻ tính là một tháng.
              </Text>
            )}
          </>
        )}
        <View style={s.between}>
          <Text style={[s.muted, { color: colors.light }]}>
            {lending ? 'Đã thu hồi' : 'Đã trả'}
          </Text>
          <Amount
            value={loanTotalAmount(loan) - remaining}
            style={{ color: colors.card }}
          />
        </View>
      </AppCard>
      <AppCard>
        <Text style={s.heading}>Chi tiết tiền vay</Text>
        <View style={s.between}>
          <Text style={s.muted}>Tiền gốc</Text>
          <Amount value={loan.amount} />
        </View>
        <View style={s.between}>
          <Text style={s.muted}>
            {lending ? 'Lãi / phí cần thu' : 'Phí phát sinh'}
          </Text>
          <Amount value={totalLoanCosts(loan)} />
        </View>
        {costs.map((cost) => (
          <View key={cost.id} style={[s.between, { paddingLeft: 12 }]}>
            <Text style={[s.muted, { flex: 1 }]}>{cost.name}</Text>
            <Amount
              value={cost.amount}
              style={[s.muted, { color: colors.expense, fontWeight: '500' }]}
            />
          </View>
        ))}
        <View style={s.between}>
          <Text style={s.muted}>
            {lending ? 'Tổng cần thu hồi' : 'Tổng khoản vay'}
          </Text>
          <Amount value={loanTotalAmount(loan)} />
        </View>
      </AppCard>
      <AppCard>
        <Text style={s.heading}>Thông tin khoản vay</Text>
        <Text style={s.muted}>
          {lending ? 'Ngày cho vay' : 'Ngày nhận'}:{' '}
          {new Date(loan.occurred_at).toLocaleDateString('vi-VN')}
        </Text>
        <Text style={s.text}>
          {loan.due_at
            ? `Có kỳ hạn · Đến hạn: ${new Date(loan.due_at).toLocaleDateString('vi-VN')}`
            : 'Không kỳ hạn'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/accounts/[id]',
              params: { id: loan.account_id },
            })
          }
        >
          <Text style={s.text}>
            {lending ? 'Tài khoản xuất tiền' : 'Tài khoản nhận'}:{' '}
            {account?.name}
          </Text>
        </Pressable>
        {loan.exclude_from_balance === 1 && (
          <Text style={s.muted}>Không tính vào số dư</Text>
        )}
        {!!loan.note && (
          <>
            <View style={s.divider} />
            <Text style={s.label}>Ghi chú</Text>
            <Text style={s.text}>{loan.note}</Text>
          </>
        )}
      </AppCard>
      {!!loan.due_at && remaining > 0 && (
        <LoanReminderCard
          key={`${loan.id}:${loan.payment_day ?? ''}:${loan.payment_time_minutes ?? 540}`}
          loan={loan}
        />
      )}
      <LoanPaymentHistory
        key={loan.id}
        payments={payments}
        accounts={data.accounts}
        lending={lending}
      />
    </ScreenContainer>
  );
}

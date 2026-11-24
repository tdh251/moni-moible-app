import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AppCard,
  ConfirmationDialog,
  EmptyState,
  ScreenContainer,
  PrimaryButton,
  s,
} from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import { LoanReminderCard } from '../../features/loans/LoanReminderCard';
import { LoanPaymentHistory } from '../../features/loans/LoanPaymentHistory';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { colors } from '../../theme';
import {
  HeroCard,
  MoneyRow,
  ProgressBar,
  StatusBadge,
} from '../../components/ui/primitives';
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
        true,
      )
    ) {
      if (await mutate((repo) => repo.deleteLoan(id))) router.back();
    }
  };
  return (
    <ScreenContainer
      title={lending ? 'Chi tiết cho vay' : 'Chi tiết khoản vay'}
      footer={
        remaining > 0 ? (
          <PrimaryButton
            icon={lending ? 'arrow-down-outline' : 'arrow-up-outline'}
            label={lending ? 'Thu hồi tiền' : 'Trả nợ'}
            disabled={busy}
            onPress={() =>
              router.push({ pathname: '/loans/repay/[id]', params: { id } })
            }
          />
        ) : undefined
      }
      rightAction={
        <ActionMenu
          label="Thao tác khoản vay"
          disabled={busy}
          actions={[
            {
              label: lending ? 'Xóa khoản cho vay' : 'Xóa khoản vay',
              icon: 'trash-outline',
              danger: true,
              onPress: () => void remove(),
            },
          ]}
        />
      }
      back
    >
      <HeroCard
        label={lending ? 'Cần thu hồi' : 'Cần thanh toán'}
        value={remaining}
        subtitle={loan.lender}
        rightAction={
          <StatusBadge
            label={
              remaining > 0
                ? lending
                  ? 'Cần thu hồi'
                  : 'Còn nợ'
                : 'Đã tất toán'
            }
            tone={remaining > 0 ? 'warning' : 'positive'}
          />
        }
      >
        <ProgressBar
          value={(loanTotalAmount(loan) - remaining) / loanTotalAmount(loan)}
          label={lending ? 'Tỷ lệ đã thu hồi' : 'Tỷ lệ đã trả'}
          light
        />
        {monthly && (
          <MoneyRow
            label={lending ? 'Trung bình mỗi tháng' : 'Cần trả mỗi tháng'}
            value={monthly.amount}
            tone={colors.onDark}
            labelTone={colors.onDarkMuted}
          />
        )}
        {monthly && lending && (
          <Text style={[s.muted, { color: colors.onDarkMuted }]}>
            Chia đều trong {monthly.months} tháng, làm tròn lên theo VND; phần
            tháng lẻ tính một tháng.
          </Text>
        )}
        <MoneyRow
          label={lending ? 'Đã thu hồi' : 'Đã trả'}
          value={loanTotalAmount(loan) - remaining}
          tone={colors.onDark}
          labelTone={colors.onDarkMuted}
        />
      </HeroCard>
      <AppCard>
        <Text style={s.heading}>Chi tiết tiền vay</Text>
        <MoneyRow label="Tiền gốc" value={loan.amount} />
        <MoneyRow
          label={lending ? 'Lãi / phí cần thu' : 'Phí phát sinh'}
          value={totalLoanCosts(loan)}
        />
        {costs.map((cost) => (
          <View key={cost.id} style={{ paddingLeft: 12 }}>
            <MoneyRow
              label={cost.name}
              value={cost.amount}
              tone={colors.expense}
            />
          </View>
        ))}
        <View style={s.divider} />
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.brandMuted,
          }}
        >
          <MoneyRow
            label={lending ? 'Tổng cần thu hồi' : 'Tổng khoản vay'}
            value={loanTotalAmount(loan)}
            strong
          />
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

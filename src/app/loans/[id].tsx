import { Pressable, Text, View } from 'react-native';
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
import { LoanReminderCard } from '../../features/loans/LoanReminderCard';
import {
  loanOutstanding,
  parseLoanCosts,
  totalLoanCosts,
  loanTotalAmount,
  loanPaymentTotal,
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
      back
    >
      <AppCard>
        <Text style={s.muted}>{lending ? 'Cần thu hồi' : 'Còn nợ'}</Text>
        <Amount value={remaining} style={{ fontSize: 30, lineHeight: 42 }} />
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
        <View style={s.between}>
          <Text style={s.muted}>
            {lending ? 'Tổng cần thu hồi' : 'Tổng khoản vay'}
          </Text>
          <Amount value={loanTotalAmount(loan)} />
        </View>
        <View style={s.between}>
          <Text style={s.muted}>{lending ? 'Đã thu hồi' : 'Đã trả'}</Text>
          <Amount value={loanTotalAmount(loan) - remaining} />
        </View>
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
        <Text style={s.muted}>
          {lending
            ? loan.exclude_from_balance === 1
              ? 'Không trừ tiền cho vay khỏi tài khoản.'
              : 'Chỉ tiền gốc đã được trừ khỏi tài khoản xuất tiền.'
            : loan.exclude_from_balance === 1
              ? 'Không cộng tiền vay vào tài khoản nhận.'
              : 'Chỉ tiền gốc đã được cộng vào tài khoản nhận.'}
        </Text>
        {!!loan.note && <Text style={s.text}>{loan.note}</Text>}
      </AppCard>
      {!!loan.due_at && remaining > 0 && (
        <LoanReminderCard
          key={`${loan.id}:${loan.payment_day ?? ''}`}
          loan={loan}
        />
      )}
      {monthly && (
        <AppCard>
          <Text style={s.heading}>
            {lending ? 'Trung bình cần thu mỗi tháng' : 'Cần trả mỗi tháng'}
          </Text>
          <Amount value={monthly.amount} />
          {lending && (
            <Text style={s.muted}>
              Tổng khoản vay chia đều cho {monthly.months} tháng, làm tròn lên
              theo VND. Phần tháng lẻ tính là một tháng.
            </Text>
          )}
        </AppCard>
      )}
      {costs.length > 0 && (
        <AppCard>
          <Text style={s.heading}>
            {lending ? 'Lãi / phí cần thu' : 'Phí phát sinh'}
          </Text>
          {costs.map((cost) => (
            <View key={cost.id} style={s.between}>
              <Text style={[s.text, { flex: 1 }]}>{cost.name}</Text>
              <Amount value={cost.amount} />
            </View>
          ))}
          <View style={s.between}>
            <Text style={s.label}>Tổng chi phí</Text>
            <Amount value={totalLoanCosts(loan)} />
          </View>
          {lending && (
            <Text style={s.muted}>Đã cộng vào tổng cần thu hồi.</Text>
          )}
        </AppCard>
      )}
      {remaining > 0 && (
        <PrimaryButton
          label={lending ? 'Thu hồi tiền' : 'Trả nợ'}
          icon={lending ? 'arrow-down-outline' : 'arrow-up-outline'}
          disabled={busy}
          onPress={() =>
            router.push({ pathname: '/loans/repay/[id]', params: { id } })
          }
        />
      )}
      <Text style={s.heading}>Lịch sử trả nợ</Text>
      {payments.map((payment) => (
        <AppCard key={payment.id}>
          <View style={s.between}>
            <Text style={s.muted}>
              {new Date(payment.occurred_at).toLocaleDateString('vi-VN')}
            </Text>
            <Amount value={loanPaymentTotal(payment)} />
          </View>
          {(payment.fee_amount ?? 0) > 0 && (
            <>
              <View style={s.between}>
                <Text style={s.muted}>{lending ? 'Thu hồi' : 'Trả nợ'}</Text>
                <Amount value={payment.amount} />
              </View>
              <View style={s.between}>
                <Text style={s.muted}>Phụ phí tất toán</Text>
                <Amount value={payment.fee_amount ?? 0} />
              </View>
              <Text style={s.muted}>
                {lending
                  ? 'Tổng tiền phía trên đã cộng vào tài khoản.'
                  : 'Tổng tiền phía trên đã trừ từ tài khoản.'}
              </Text>
            </>
          )}
          <Text style={s.text}>
            {data.accounts.find((a) => a.id === payment.account_id)?.name}
          </Text>
        </AppCard>
      ))}
      {!payments.length && (
        <Text style={s.muted}>
          {lending
            ? 'Chưa ghi nhận lần thu hồi nào.'
            : 'Chưa ghi nhận lần trả nợ nào.'}
        </Text>
      )}
      <SecondaryButton
        label={lending ? 'Xóa khoản cho vay' : 'Xóa khoản vay'}
        danger
        icon="trash-outline"
        disabled={busy}
        onPress={() => void remove()}
      />
    </ScreenContainer>
  );
}

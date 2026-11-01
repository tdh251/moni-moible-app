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
      <ScreenContainer title="Vay/mượn" back>
        <EmptyState
          title="Không tìm thấy khoản vay"
          description="Vui lòng quay lại danh sách."
        />
      </ScreenContainer>
    );
  const payments = (data.loanPayments ?? []).filter((p) => p.loan_id === id);
  const remaining = loanOutstanding(loan, payments);
  const costs = parseLoanCosts(loan);
  const monthly = loanMonthlyPayment(loan);
  const account = data.accounts.find((a) => a.id === loan.account_id);
  const remove = async () => {
    if (
      await ConfirmationDialog(
        'Xóa khoản vay/mượn?',
        'Khoản vay và các lần trả nợ sẽ được xóa. Số dư các tài khoản liên quan được tính lại. Chỉ dùng khi ghi nhầm khoản vay.',
      )
    ) {
      if (await mutate((repo) => repo.deleteLoan(id))) router.back();
    }
  };
  const removePayment = async (paymentId: string) => {
    if (
      await ConfirmationDialog(
        'Xóa lần trả nợ?',
        'Số tiền sẽ được hoàn lại vào tài khoản trả nợ và khoản nợ được tính lại.',
      )
    )
      await mutate((repo) => repo.deleteLoanPayment(paymentId));
  };
  return (
    <ScreenContainer title={loan.lender} subtitle="Chi tiết vay/mượn" back>
      <AppCard>
        <Text style={s.muted}>Còn nợ</Text>
        <Amount value={remaining} style={{ fontSize: 30, lineHeight: 42 }} />
        <View style={s.between}>
          <Text style={s.muted}>Tiền gốc</Text>
          <Amount value={loan.amount} />
        </View>
        <View style={s.between}>
          <Text style={s.muted}>Chi phí vay</Text>
          <Amount value={totalLoanCosts(loan)} />
        </View>
        <View style={s.between}>
          <Text style={s.muted}>Tổng khoản vay</Text>
          <Amount value={loanTotalAmount(loan)} />
        </View>
        <View style={s.between}>
          <Text style={s.muted}>Đã trả nợ</Text>
          <Amount value={loanTotalAmount(loan) - remaining} />
        </View>
        <Text style={s.muted}>
          Ngày nhận: {new Date(loan.occurred_at).toLocaleDateString('vi-VN')}
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
          <Text style={s.text}>Tài khoản nhận: {account?.name}</Text>
        </Pressable>
        <Text style={s.muted}>
          {loan.exclude_from_balance === 1
            ? 'Không cộng tiền vay vào tài khoản nhận.'
            : 'Chỉ tiền gốc đã được cộng vào tài khoản nhận.'}
        </Text>
        {!!loan.note && <Text style={s.text}>{loan.note}</Text>}
      </AppCard>
      {monthly && (
        <AppCard>
          <Text style={s.heading}>Trung bình cần trả mỗi tháng</Text>
          <Amount value={monthly.amount} />
          <Text style={s.muted}>
            Tổng khoản vay chia đều cho {monthly.months} tháng, làm tròn lên
            theo VND. Phần tháng lẻ tính là một tháng.
          </Text>
        </AppCard>
      )}
      {costs.length > 0 && (
        <AppCard>
          <Text style={s.heading}>Chi phí vay</Text>
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
          <Text style={s.muted}>Đã cộng vào tổng khoản vay phải trả.</Text>
        </AppCard>
      )}
      {remaining > 0 && (
        <PrimaryButton
          label="Trả nợ"
          icon="arrow-up-outline"
          disabled={busy}
          onPress={() =>
            router.push({ pathname: '/loans/repay/[id]', params: { id } })
          }
        />
      )}
      <Text style={s.heading}>Lịch sử trả nợ · {payments.length}</Text>
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
                <Text style={s.muted}>Trả nợ</Text>
                <Amount value={payment.amount} />
              </View>
              <View style={s.between}>
                <Text style={s.muted}>Phụ phí tất toán</Text>
                <Amount value={payment.fee_amount ?? 0} />
              </View>
              <Text style={s.muted}>
                Tổng tiền phía trên đã trừ từ tài khoản.
              </Text>
            </>
          )}
          <Text style={s.text}>
            {data.accounts.find((a) => a.id === payment.account_id)?.name}
          </Text>
          <SecondaryButton
            label="Xóa lần trả nợ"
            icon="trash-outline"
            disabled={busy}
            onPress={() => void removePayment(payment.id)}
          />
        </AppCard>
      ))}
      {!payments.length && (
        <Text style={s.muted}>Chưa ghi nhận lần trả nợ nào.</Text>
      )}
      <SecondaryButton
        label="Xóa khoản vay/mượn"
        icon="trash-outline"
        disabled={busy}
        onPress={() => void remove()}
      />
    </ScreenContainer>
  );
}

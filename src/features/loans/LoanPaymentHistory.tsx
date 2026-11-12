import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Amount,
  AppCard,
  ConfirmationDialog,
  EmptyState,
  IconButton,
  s,
} from '../../components/ui';
import { showError, useFinance } from '../../hooks/finance';
import { loanPaymentTotal } from '../../services/loans';
import type { Account, LoanPayment } from '../../types/finance';

export function LoanPaymentHistory({
  payments,
  accounts,
  lending,
}: {
  payments: LoanPayment[];
  accounts: Account[];
  lending: boolean;
}) {
  const { mutate, busy } = useFinance();
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const ordered = [...payments].sort(
    (a, b) =>
      b.occurred_at.localeCompare(a.occurred_at) ||
      b.created_at.localeCompare(a.created_at) ||
      b.id.localeCompare(a.id),
  );
  const remove = async (payment: LoanPayment) => {
    if (deletingRef.current || busy) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      if (
        await ConfirmationDialog(
          lending ? 'Xóa lần thu hồi?' : 'Xóa lần trả nợ?',
          `Xóa lần ${lending ? 'thu hồi' : 'trả nợ'} ngày ${new Date(payment.occurred_at).toLocaleDateString('vi-VN')}? Số dư tài khoản và số tiền còn lại của khoản vay sẽ được tính lại.`,
          true,
        )
      )
        await mutate((repo) => repo.deleteLoanPayment(payment.id));
    } catch (error) {
      showError(error);
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };
  return (
    <>
      <Text style={s.heading}>
        {lending ? 'Lịch sử thu hồi' : 'Lịch sử trả nợ'}
      </Text>
      {ordered.map((payment) => (
        <AppCard key={payment.id}>
          <View style={s.between}>
            <Text style={[s.muted, { flex: 1 }]}>
              {new Date(payment.occurred_at).toLocaleDateString('vi-VN')}
            </Text>
            <IconButton
              label={`${lending ? 'Xóa lần thu hồi' : 'Xóa lần trả nợ'} ngày ${new Date(payment.occurred_at).toLocaleDateString('vi-VN')}`}
              icon="trash-outline"
              danger
              disabled={busy || deleting}
              onPress={() => void remove(payment)}
            />
          </View>
          <View style={s.between}>
            <Text style={[s.text, { flex: 1 }]}>
              {accounts.find((value) => value.id === payment.account_id)?.name}
            </Text>
            <Amount
              value={loanPaymentTotal(payment)}
              style={{ textAlign: 'right' }}
            />
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
        </AppCard>
      ))}
      {!ordered.length && (
        <EmptyState
          title={lending ? 'Chưa có lần thu hồi' : 'Chưa có lần trả nợ'}
          description="Các lần thanh toán sẽ xuất hiện tại đây."
        />
      )}
    </>
  );
}

import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import {
  AppCard,
  ConfirmationDialog,
  EmptyState,
  IconButton,
  s,
} from '../../components/ui';
import { MoneyRow } from '../../components/ui/primitives';
import { colors } from '../../theme';
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
      {!!ordered.length && (
        <AppCard>
          {ordered.map((payment, index) => (
            <View
              key={payment.id}
              style={{
                gap: 8,
                paddingTop: index ? 12 : 0,
                borderTopWidth: index ? 1 : 0,
                borderTopColor: colors.border,
              }}
            >
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
              <MoneyRow
                label={
                  accounts.find((value) => value.id === payment.account_id)
                    ?.name ?? 'Tài khoản'
                }
                value={loanPaymentTotal(payment)}
                strong
              />
              {(payment.fee_amount ?? 0) > 0 && (
                <>
                  <MoneyRow
                    label={lending ? 'Thu hồi' : 'Trả nợ'}
                    value={payment.amount}
                  />
                  <MoneyRow
                    label="Phụ phí tất toán"
                    value={payment.fee_amount ?? 0}
                  />
                  <Text style={s.muted}>
                    {lending
                      ? 'Tổng tiền phía trên đã cộng vào tài khoản.'
                      : 'Tổng tiền phía trên đã trừ từ tài khoản.'}
                  </Text>
                </>
              )}
            </View>
          ))}
        </AppCard>
      )}
      {!ordered.length && (
        <EmptyState
          title={lending ? 'Chưa có lần thu hồi' : 'Chưa có lần trả nợ'}
          description="Các lần thanh toán sẽ xuất hiện tại đây."
        />
      )}
    </>
  );
}

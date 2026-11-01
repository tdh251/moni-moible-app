import { useLocalSearchParams } from 'expo-router';
import { EmptyState, ScreenContainer } from '../../../components/ui';
import { LoanForm } from '../../../features/loans/LoanForm';
import { useFinance } from '../../../hooks/finance';
export default function RepayLoan() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useFinance();
  const loan = data.loans?.find((loan) => loan.id === id);
  return (
    <ScreenContainer title="Trả nợ" back>
      {loan ? (
        <LoanForm loan={loan} />
      ) : (
        <EmptyState
          title="Không tìm thấy khoản vay"
          description="Vui lòng quay lại danh sách."
        />
      )}
    </ScreenContainer>
  );
}

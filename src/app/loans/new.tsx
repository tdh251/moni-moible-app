import { ScreenContainer } from '../../components/ui';
import { LoanForm } from '../../features/loans/LoanForm';
export default function NewLoan() {
  return (
    <ScreenContainer title="Thêm vay/mượn" back>
      <LoanForm />
    </ScreenContainer>
  );
}

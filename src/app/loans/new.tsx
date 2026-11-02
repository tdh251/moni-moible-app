import { ScreenContainer } from '../../components/ui';
import { LoanForm } from '../../features/loans/LoanForm';
import { useLocalSearchParams } from 'expo-router';
export default function NewLoan() {
  const { direction } = useLocalSearchParams<{ direction?: string }>();
  const lending = direction === 'lend';
  return (
    <ScreenContainer title={lending ? 'Thêm cho vay' : 'Thêm vay'} back>
      <LoanForm direction={lending ? 'lend' : 'borrow'} />
    </ScreenContainer>
  );
}

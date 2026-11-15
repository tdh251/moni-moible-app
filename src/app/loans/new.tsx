import { LoanForm } from '../../features/loans/LoanForm';
import { useLocalSearchParams } from 'expo-router';
export default function NewLoan() {
  const { direction } = useLocalSearchParams<{ direction?: string }>();
  const lending = direction === 'lend';
  return <LoanForm direction={lending ? 'lend' : 'borrow'} />;
}

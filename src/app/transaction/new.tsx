import { Redirect, useLocalSearchParams } from 'expo-router';
import { TransactionForm } from '../../features/transactions/TransactionForm';
import { useFinance } from '../../hooks/finance';
export default function NewTransaction() {
  const { type, account } = useLocalSearchParams<{
    type?: string;
    account?: string;
  }>();
  const { data } = useFinance();
  if (!data.onboarded) return <Redirect href="/onboarding" />;
  return (
    <TransactionForm
      initialType={type === 'income' || type === 'transfer' ? type : 'expense'}
      initialAccount={account}
    />
  );
}

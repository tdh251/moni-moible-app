import { Redirect, useLocalSearchParams } from 'expo-router';
import { TransactionForm } from '../../features/transactions/TransactionForm';
import { useFinance } from '../../hooks/finance';
import { PurchaseForm } from '../../features/purchases/PurchaseForm';
export default function NewTransaction() {
  const { type, account } = useLocalSearchParams<{
    type?: string;
    account?: string;
  }>();
  const { data } = useFinance();
  if (!data.onboarded) return <Redirect href="/onboarding" />;
  if (type === 'purchase') return <PurchaseForm initialAccount={account} />;
  return (
    <TransactionForm
      initialType={type === 'income' || type === 'transfer' ? type : 'expense'}
      initialAccount={account}
    />
  );
}

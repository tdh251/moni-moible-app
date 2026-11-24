import { Redirect, useLocalSearchParams } from 'expo-router';
import { PurchaseForm } from '../../features/purchases/PurchaseForm';
import { useFinance } from '../../hooks/finance';

export default function NewPurchase() {
  const { account } = useLocalSearchParams<{ account?: string }>();
  const { data } = useFinance();
  if (!data.onboarded) return <Redirect href="/onboarding" />;
  return <PurchaseForm initialAccount={account} />;
}

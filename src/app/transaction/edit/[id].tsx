import { useLocalSearchParams } from 'expo-router';
import { TransactionForm } from '../../../features/transactions/TransactionForm';
import { useFinance } from '../../../hooks/finance';
import { EmptyState, ScreenContainer } from '../../../components/ui';
export default function EditTransaction() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useFinance();
  const t = data.transactions.find((x) => x.id === id);
  return t ? (
    <TransactionForm key={t.id} existing={t} />
  ) : (
    <ScreenContainer title="Giao dịch" back>
      <EmptyState
        title="Không tìm thấy giao dịch"
        description="Giao dịch có thể đã được xóa."
      />
    </ScreenContainer>
  );
}

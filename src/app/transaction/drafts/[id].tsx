import { useLocalSearchParams } from 'expo-router';
import { EmptyState, ScreenContainer } from '../../../components/ui';
import { TransactionForm } from '../../../features/transactions/TransactionForm';
import { useFinance } from '../../../hooks/finance';

export default function EditTransactionDraft() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useFinance();
  const draft = data.transactionDrafts?.find((row) => row.id === id);
  return draft ? (
    <TransactionForm key={draft.id} savedDraft={draft} />
  ) : (
    <ScreenContainer title="Bản nháp" back>
      <EmptyState
        title="Không tìm thấy bản nháp"
        description="Bản nháp có thể đã được ghi thành giao dịch hoặc đã xóa."
        icon="document-text-outline"
      />
    </ScreenContainer>
  );
}

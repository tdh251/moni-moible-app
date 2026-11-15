import { ScreenContainer } from '../../../components/ui';
import { TransactionDraftList } from '../../../features/transactions/TransactionDraftList';
import { useFinance } from '../../../hooks/finance';

export default function TransactionDrafts() {
  const { data } = useFinance();
  return (
    <ScreenContainer
      title={`B?n nh?p (${data.transactionDrafts?.length ?? 0})`}
      subtitle="Ch?a t?nh v?o s? d? v? th?ng k?. M? b?n nh?p ?? ch?nh s?a ho?c ghi giao d?ch."
      back
      scroll={false}
    >
      <TransactionDraftList />
    </ScreenContainer>
  );
}

import { ScreenContainer } from '../../../components/ui';
import { TransactionDraftList } from '../../../features/transactions/TransactionDraftList';
import { useFinance } from '../../../hooks/finance';

export default function TransactionDrafts() {
  const { data } = useFinance();
  return (
    <ScreenContainer
      title={`Bản nháp (${data.transactionDrafts?.length ?? 0})`}
      subtitle="Chưa tính vào số dư và thống kê. Mở bản nháp để chỉnh sửa hoặc ghi giao dịch."
      back
      scroll={false}
    >
      <TransactionDraftList />
    </ScreenContainer>
  );
}

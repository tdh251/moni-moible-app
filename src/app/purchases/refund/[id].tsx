import { useLocalSearchParams } from 'expo-router';
import { EmptyState, ScreenContainer } from '../../../components/ui';
import { PurchaseForm } from '../../../features/purchases/PurchaseForm';
import { useFinance } from '../../../hooks/finance';

export default function RefundPurchase() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useFinance();
  const purchase = data.purchases?.find((row) => row.id === id);
  if (!purchase)
    return (
      <ScreenContainer title="Hoàn tiền mua hộ" back>
        <EmptyState
          title="Không tìm thấy khoản mua hộ"
          description="Vui lòng quay lại danh sách."
        />
      </ScreenContainer>
    );
  return <PurchaseForm key={purchase.id} purchase={purchase} refund />;
}

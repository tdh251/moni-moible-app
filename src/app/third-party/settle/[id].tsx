import { useLocalSearchParams } from 'expo-router';
import { EmptyState, ScreenContainer } from '../../../components/ui';
import { useFinance } from '../../../hooks/finance';
import { ThirdPartySettlementForm } from '../../../features/third-party/ThirdPartySettlementForm';
export default function SettleThirdPartyCase() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useFinance();
  const item = data.thirdPartyCases?.find((row) => row.id === id);
  if (!item)
    return (
      <ScreenContainer title="Thu chi hộ" back>
        <EmptyState
          title="Không tìm thấy hồ sơ"
          description="Vui lòng quay lại danh sách."
        />
      </ScreenContainer>
    );
  return <ThirdPartySettlementForm key={item.id} item={item} />;
}

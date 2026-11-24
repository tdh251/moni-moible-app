import { useLocalSearchParams } from 'expo-router';
import { EmptyState, ScreenContainer } from '../../../components/ui';
import { useFinance } from '../../../hooks/finance';
import { ThirdPartyCaseForm } from '../../../features/third-party/ThirdPartyCaseForm';
export default function EditThirdPartyCase() {
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
  if (item.status === 'completed')
    return (
      <ScreenContainer title="Thu chi hộ" back>
        <EmptyState
          title="Hồ sơ đã hoàn tất"
          description="Mở lại hồ sơ trong menu chi tiết trước khi chỉnh sửa."
        />
      </ScreenContainer>
    );
  return <ThirdPartyCaseForm key={item.id} item={item} />;
}

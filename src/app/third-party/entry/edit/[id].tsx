import { useLocalSearchParams } from 'expo-router';
import { EmptyState, ScreenContainer } from '../../../../components/ui';
import { useFinance } from '../../../../hooks/finance';
import { ThirdPartyEntryForm } from '../../../../features/third-party/ThirdPartyEntryForm';
export default function EditThirdPartyEntry() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useFinance();
  const entry = data.thirdPartyEntries?.find((row) => row.id === id);
  const item = data.thirdPartyCases?.find((row) => row.id === entry?.case_id);
  if (!item || !entry)
    return (
      <ScreenContainer title="Thu chi hộ" back>
        <EmptyState
          title="Không tìm thấy bút toán"
          description="Vui lòng quay lại danh sách."
        />
      </ScreenContainer>
    );
  return <ThirdPartyEntryForm key={entry.id} item={item} entry={entry} />;
}

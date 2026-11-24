import { useLocalSearchParams } from 'expo-router';
import { EmptyState, ScreenContainer } from '../../../components/ui';
import { useFinance } from '../../../hooks/finance';
import { ThirdPartyEntryForm } from '../../../features/third-party/ThirdPartyEntryForm';
import { thirdPartyEntryLabels } from '../../../services/third-party';
import type { ThirdPartyEntryKind } from '../../../types/third-party';
export default function NewThirdPartyEntry() {
  const { caseId, kind } = useLocalSearchParams<{
    caseId: string;
    kind?: string;
  }>();
  const { data } = useFinance();
  const item = data.thirdPartyCases?.find((row) => row.id === caseId);
  if (!item)
    return (
      <ScreenContainer title="Thu chi hộ" back>
        <EmptyState
          title="Không tìm thấy hồ sơ"
          description="Vui lòng quay lại danh sách."
        />
      </ScreenContainer>
    );
  const initialKind =
    kind && Object.hasOwn(thirdPartyEntryLabels, kind)
      ? (kind as ThirdPartyEntryKind)
      : undefined;
  return (
    <ThirdPartyEntryForm key={item.id} item={item} initialKind={initialKind} />
  );
}

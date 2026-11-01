import { ScreenContainer } from '../../components/ui';
import { TagManager } from '../../features/tags/TagManager';

export default function Tags() {
  return (
    <ScreenContainer
      title="Tags"
      subtitle="Nhóm giao dịch theo cách của bạn."
      back
      scroll={false}
    >
      <TagManager />
    </ScreenContainer>
  );
}

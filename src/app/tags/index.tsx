import { useState } from 'react';
import { ScreenContainer } from '../../components/ui';
import { TagManager } from '../../features/tags/TagManager';

export default function Tags() {
  const [editing, setEditing] = useState(false);
  return (
    <ScreenContainer
      title="Tags"
      subtitle="Nhóm giao dịch theo cách của bạn."
      back={!editing}
      scroll={false}
    >
      <TagManager floatingAdd onEditingChange={setEditing} />
    </ScreenContainer>
  );
}

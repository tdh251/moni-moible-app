import { useState } from 'react';
import { Choices, ScreenContainer } from '../../components/ui';
import { CategoryManager } from '../../features/categories/CategoryManager';
import type { CategoryType } from '../../types/finance';

export default function Categories() {
  const [type, setType] = useState<CategoryType>('expense');
  const [editing, setEditing] = useState(false);
  return (
    <ScreenContainer
      title="Danh mục"
      subtitle="Một cấp đơn giản, dễ tìm và dễ ghi."
      back={!editing}
      scroll={false}
    >
      <Choices
        value={type}
        onChange={(type) => {
          setType(type);
          setEditing(false);
        }}
        options={[
          { value: 'expense', label: 'Chi tiêu' },
          { value: 'income', label: 'Thu nhập' },
        ]}
      />
      <CategoryManager
        key={type}
        type={type}
        floatingAdd
        onEditingChange={setEditing}
      />
    </ScreenContainer>
  );
}

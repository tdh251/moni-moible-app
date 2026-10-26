import { useState } from 'react';
import { Choices, ScreenContainer } from '../../components/ui';
import { CategoryManager } from '../../features/categories/CategoryManager';
import type { CategoryType } from '../../types/finance';

export default function Categories() {
  const [type, setType] = useState<CategoryType>('expense');
  return (
    <ScreenContainer
      title="Danh mục"
      subtitle="Một cấp đơn giản, dễ tìm và dễ ghi."
      back
      scroll={false}
    >
      <Choices
        value={type}
        onChange={setType}
        options={[
          { value: 'expense', label: 'Chi tiêu' },
          { value: 'income', label: 'Thu nhập' },
        ]}
      />
      <CategoryManager key={type} type={type} />
    </ScreenContainer>
  );
}

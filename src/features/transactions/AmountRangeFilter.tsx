import { useState } from 'react';
import { Text, View } from 'react-native';
import { Field, SecondaryButton, s } from '../../components/ui';
import type { Filters } from '../../types/finance';
import { ensure, parseAmount } from '../../services/accounting/money';
import { showError } from '../../hooks/finance';
import { formatVnd } from '../../utils/format';

export function AmountRangeFilter({
  filters,
  onApply,
}: {
  filters: Filters;
  onApply: (value: Partial<Filters>) => void;
}) {
  const [minimum, setMinimum] = useState(
    filters.minAmount === undefined ? '' : String(filters.minAmount),
  );
  const [maximum, setMaximum] = useState(
    filters.maxAmount === undefined ? '' : String(filters.maxAmount),
  );
  const apply = () => {
    try {
      const minAmount =
        minimum.trim() === '' ? undefined : parseAmount(minimum, true);
      const maxAmount =
        maximum.trim() === '' ? undefined : parseAmount(maximum, true);
      ensure(
        minAmount === undefined ||
          maxAmount === undefined ||
          minAmount <= maxAmount,
        'Số tiền từ phải nhỏ hơn hoặc bằng số tiền đến.',
      );
      onApply({ minAmount, maxAmount });
    } catch (error) {
      showError(error);
    }
  };
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.label}>Tổng tiền giao dịch (VND)</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Từ"
            keyboardType="number-pad"
            maxLength={16}
            placeholder="Không giới hạn"
            value={minimum}
            onChangeText={setMinimum}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Đến"
            keyboardType="number-pad"
            maxLength={16}
            placeholder="Không giới hạn"
            value={maximum}
            onChangeText={setMaximum}
          />
        </View>
      </View>
      <Text style={s.muted}>
        Lọc theo tổng sau điều chỉnh, gồm cả hai đầu khoảng. Để trống để không
        giới hạn.
      </Text>
      <SecondaryButton label="Áp dụng khoảng tiền" onPress={apply} />
      {(filters.minAmount !== undefined || filters.maxAmount !== undefined) && (
        <Text style={s.muted}>
          Đang lọc:{' '}
          {filters.minAmount === undefined
            ? 'không giới hạn'
            : formatVnd(filters.minAmount)}{' '}
          →{' '}
          {filters.maxAmount === undefined
            ? 'không giới hạn'
            : formatVnd(filters.maxAmount)}
        </Text>
      )}
    </View>
  );
}

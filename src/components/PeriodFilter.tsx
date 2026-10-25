import { Text, View, Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Choices, Icon, s } from './ui';
import type { Filters, Period } from '../types/finance';
import { periodLabel, periodNames } from '../utils/format';
import { shiftPeriod } from '../services/accounting/ledger';
export function PeriodFilter({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (v: Partial<Filters>) => void;
}) {
  const [picker, setPicker] = useState(false);
  return (
    <View style={{ gap: 12 }}>
      <Choices
        value={value.period}
        onChange={(period) => onChange({ period })}
        options={(Object.keys(periodNames) as Period[]).map((p) => ({
          value: p,
          label: periodNames[p],
        }))}
      />
      <View style={s.between}>
        <Pressable
          accessibilityLabel="Kỳ trước"
          accessibilityRole="button"
          hitSlop={8}
          style={{ padding: 8 }}
          onPress={() =>
            onChange({ date: shiftPeriod(value.date, value.period, -1) })
          }
        >
          <Icon name="chevron-back-outline" />
        </Pressable>
        <Pressable
          accessibilityLabel="Chọn ngày trong kỳ"
          accessibilityRole="button"
          onPress={() => setPicker(true)}
        >
          <Text style={[s.text, { fontWeight: '600' }]}>
            {periodLabel(value.date, value.period)}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Kỳ sau"
          accessibilityRole="button"
          hitSlop={8}
          style={{ padding: 8 }}
          onPress={() =>
            onChange({ date: shiftPeriod(value.date, value.period, 1) })
          }
        >
          <Icon name="chevron-forward-outline" />
        </Pressable>
      </View>
      {picker && (
        <DateTimePicker
          value={new Date(value.date)}
          mode="date"
          onValueChange={(_, date) => {
            setPicker(false);
            onChange({ date: date.toISOString() });
          }}
          onDismiss={() => setPicker(false)}
        />
      )}
    </View>
  );
}

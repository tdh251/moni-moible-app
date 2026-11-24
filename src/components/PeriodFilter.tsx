import { Text, View, Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { IconButton, s } from './ui';
import { SegmentedControl } from './ui/SegmentedControl';
import { colors, radius } from '../theme';
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
    <View style={{ gap: 4 }}>
      <SegmentedControl
        value={value.period}
        onChange={(period) => onChange({ period })}
        options={(Object.keys(periodNames) as Period[]).map((p) => ({
          value: p,
          label: periodNames[p],
        }))}
      />
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <IconButton
          label="Kỳ trước"
          icon="chevron-back-outline"
          onPress={() =>
            onChange({ date: shiftPeriod(value.date, value.period, -1) })
          }
        />
        <Pressable
          accessibilityLabel="Chọn ngày trong kỳ"
          accessibilityRole="button"
          onPress={() => setPicker(true)}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: radius.icon,
            backgroundColor: colors.brandMuted,
          }}
        >
          <Text style={[s.text, { fontWeight: '600' }]}>
            {periodLabel(value.date, value.period)}
          </Text>
        </Pressable>
        <IconButton
          label="Kỳ sau"
          icon="chevron-forward-outline"
          onPress={() =>
            onChange({ date: shiftPeriod(value.date, value.period, 1) })
          }
        />
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

import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Amount, s } from '../../components/ui';
import { colors } from '../../theme';
export function IncomeExpenseChart({
  income,
  expense,
}: {
  income: number;
  expense: number;
}) {
  const max = Math.max(income, expense, 1);
  return (
    <View style={{ gap: 16 }}>
      {[
        { name: 'Thu nhập', value: income, color: colors.income },
        { name: 'Chi tiêu', value: expense, color: colors.expense },
      ].map((row) => (
        <View key={row.name} style={{ gap: 8 }}>
          <View style={s.between}>
            <Text style={s.muted}>{row.name}</Text>
            <Amount value={row.value} style={{ color: row.color }} />
          </View>
          <View
            accessibilityLabel={`${row.name}: ${Math.round((row.value / max) * 100)} phần trăm so với khoản lớn hơn`}
            style={{
              height: 16,
              borderRadius: 8,
              backgroundColor: colors.background,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${(row.value / max) * 100}%`,
                backgroundColor: row.color,
                borderRadius: 8,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
export function DonutChart({
  rows,
  total,
}: {
  rows: { id: string; amount: number; color: string }[];
  total: number;
}) {
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  const segments = rows.map((row, index) => ({
    ...row,
    length: (row.amount / total) * circumference,
    offset: rows
      .slice(0, index)
      .reduce((sum, r) => sum + (r.amount / total) * circumference, 0),
  }));
  return (
    <View
      style={{ alignItems: 'center', justifyContent: 'center', height: 190 }}
    >
      <Svg
        width={190}
        height={190}
        viewBox="0 0 190 190"
        accessibilityLabel="Biểu đồ tỷ trọng danh mục"
      >
        <Circle
          cx={95}
          cy={95}
          r={radius}
          stroke={colors.border}
          strokeWidth={24}
          fill="none"
        />
        <G rotation={-90} origin="95, 95">
          {segments.map((row) => (
            <Circle
              key={row.id}
              cx={95}
              cy={95}
              r={radius}
              stroke={row.color}
              strokeWidth={24}
              fill="none"
              strokeDasharray={`${row.length} ${circumference - row.length}`}
              strokeDashoffset={-row.offset}
            />
          ))}
        </G>
      </Svg>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', alignItems: 'center' }}
      >
        <Text style={s.muted}>Tổng trong kỳ</Text>
        <Amount value={total} style={{ fontSize: 15 }} />
      </View>
    </View>
  );
}

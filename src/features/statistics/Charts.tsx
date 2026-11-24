import { Text, View } from 'react-native';
import { memo, useEffect, useMemo } from 'react';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import { Amount, s } from '../../components/ui';
import { MoneyRow } from '../../components/ui/primitives';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { colors } from '../../theme';
import { useReducedMotionPreference } from '../../hooks/motion';
import { motion } from '../../theme/motion';

function ChartBar({ ratio, color }: { ratio: number; color: string }) {
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotionPreference();
  useEffect(() => {
    progress.set(
      withTiming(ratio, {
        duration: reducedMotion ? 0 : motion.chart,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [progress, ratio, reducedMotion]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.get() }],
  }));
  return (
    <Animated.View
      style={[
        {
          height: '100%',
          width: '100%',
          backgroundColor: color,
          borderRadius: 4,
          transformOrigin: 'left',
        },
        animatedStyle,
      ]}
    />
  );
}

export const IncomeExpenseChart = memo(function IncomeExpenseChart({
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
          <MoneyRow label={row.name} value={row.value} tone={row.color} />
          <View
            accessibilityLabel={`${row.name}: ${Math.round((row.value / max) * 100)} phần trăm so với khoản lớn hơn`}
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.background,
              overflow: 'hidden',
            }}
          >
            <ChartBar ratio={row.value / max} color={row.color} />
          </View>
        </View>
      ))}
    </View>
  );
});
const chartEntering = FadeIn.duration(motion.chart).reduceMotion(
  ReduceMotion.System,
);
export const DonutChart = memo(function DonutChart({
  rows,
  total,
}: {
  rows: { id: string; amount: number; color: string }[];
  total: number;
}) {
  const { stack, largeText } = useResponsiveLayout();
  const size = stack ? 152 : 168;
  const centered = !largeText && total < 10_000_000;
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  const reducedMotion = useReducedMotionPreference();
  const segments = useMemo(() => {
    const result: {
      id: string;
      color: string;
      length: number;
      offset: number;
    }[] = [];
    let offset = 0;
    for (const row of rows) {
      const length = total > 0 ? (row.amount / total) * circumference : 0;
      result.push({ id: row.id, color: row.color, length, offset });
      offset += length;
    }
    return result;
  }, [rows, total, circumference]);
  return (
    <Animated.View
      entering={reducedMotion ? undefined : chartEntering}
      style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}
    >
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg
          width={size}
          height={size}
          viewBox="0 0 190 190"
          accessibilityLabel="Biểu đồ tỷ trọng danh mục"
        >
          <Circle
            cx={95}
            cy={95}
            r={radius}
            stroke={colors.border}
            strokeWidth={18}
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
                strokeWidth={18}
                fill="none"
                strokeDasharray={`${row.length} ${circumference - row.length}`}
                strokeDashoffset={-row.offset}
              />
            ))}
          </G>
        </Svg>
        {centered && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              alignItems: 'center',
              width: size * 0.6,
              gap: 4,
            }}
          >
            <Amount value={total} style={{ fontSize: 14, lineHeight: 20 }} />
            <Text style={[s.muted, { fontSize: 11, textAlign: 'center' }]}>
              Tổng trong kỳ
            </Text>
          </View>
        )}
      </View>
      {!centered && (
        <View style={{ alignItems: 'center', width: '100%', gap: 4 }}>
          <Text style={s.muted}>Tổng trong kỳ</Text>
          <Amount
            value={total}
            style={{
              fontSize: largeText ? 18 : 22,
              lineHeight: largeText ? 26 : 30,
            }}
          />
        </View>
      )}
    </Animated.View>
  );
});

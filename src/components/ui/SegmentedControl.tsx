import { Text, View } from 'react-native';
import { MotionPressable } from './MotionPressable';
import { colors, radius, spacing, typography } from '../../theme';

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceSecondary,
        padding: spacing.xs,
        borderRadius: radius.input,
        gap: spacing.xs,
      }}
    >
      {options.map((option) => (
        <MotionPressable
          key={option.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: option.value === value }}
          onPress={() => onChange(option.value)}
          style={{
            flex: 1,
            minHeight: 44,
            minWidth: 0,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.icon,
            backgroundColor:
              option.value === value ? colors.card : 'transparent',
          }}
        >
          <Text
            style={{
              color: option.value === value ? colors.primary : colors.text,
              ...typography.label,
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            {option.label}
          </Text>
        </MotionPressable>
      ))}
    </View>
  );
}

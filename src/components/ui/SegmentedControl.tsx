import { Text, View } from 'react-native';
import { MotionPressable } from './MotionPressable';
import { colors } from '../../theme';

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
        backgroundColor: colors.light,
        padding: 4,
        borderRadius: 16,
        gap: 4,
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
            minHeight: 48,
            paddingHorizontal: 10,
            paddingVertical: 12,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            backgroundColor:
              option.value === value ? colors.card : 'transparent',
          }}
        >
          <Text
            style={{
              color: option.value === value ? colors.primary : colors.text,
              fontSize: 14,
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

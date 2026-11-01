import { Pressable, Text } from 'react-native';
import { AppCard, Icon, s } from '../../components/ui';
import { colors } from '../../theme';
export function BalanceExclusionCheckbox({
  value,
  onChange,
  disabled = false,
  embedded = false,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  embedded?: boolean;
}) {
  const control = (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel="Không tính vào số dư"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        s.row,
        {
          minHeight: embedded ? 44 : 52,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon
        name={value ? 'checkbox-outline' : 'square-outline'}
        size={26}
        color={value ? colors.primary : colors.muted}
      />
      <Text style={[s.text, { flex: 1, fontWeight: '600' }]}>
        Không tính vào số dư
      </Text>
    </Pressable>
  );
  return embedded ? control : <AppCard>{control}</AppCard>;
}

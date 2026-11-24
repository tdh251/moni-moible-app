import { Pressable, Text, View } from 'react-native';
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
        size={22}
        color={value ? colors.primary : colors.muted}
      />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={[s.text, { fontWeight: '500' }]}>
          Không tính vào số dư
        </Text>
        <Text style={s.muted}>
          {value
            ? 'Không cộng hoặc trừ số dư tài khoản.'
            : 'Có cộng / trừ số dư theo loại giao dịch.'}
        </Text>
      </View>
    </Pressable>
  );
  return embedded ? control : <AppCard>{control}</AppCard>;
}

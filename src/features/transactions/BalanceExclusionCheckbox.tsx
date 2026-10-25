import { Pressable, Text, View } from 'react-native';
import { AppCard, Icon, s } from '../../components/ui';
import { colors } from '../../theme';
export function BalanceExclusionCheckbox({
  value,
  onChange,
  disabled = false,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <AppCard>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Không tính vào số dư"
        accessibilityState={{ checked: value, disabled }}
        disabled={disabled}
        onPress={() => onChange(!value)}
        style={({ pressed }) => [
          s.row,
          { minHeight: 52, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
        ]}
      >
        <Icon
          name={value ? 'checkbox-outline' : 'square-outline'}
          size={26}
          color={value ? colors.primary : colors.muted}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[s.text, { fontWeight: '600' }]}>
            Không tính vào số dư
          </Text>
          <Text style={s.muted}>
            Vẫn lưu trong lịch sử; thu/chi vẫn xuất hiện trong thống kê. Số dư
            tài khoản không thay đổi.
          </Text>
        </View>
      </Pressable>
    </AppCard>
  );
}

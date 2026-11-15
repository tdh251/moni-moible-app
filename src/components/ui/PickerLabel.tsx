import { Pressable, Text, View } from 'react-native';
import { s } from './index';
import { colors } from '../../theme';

export function PickerLabel({
  label,
  onAdd,
  addLabel,
  disabled = false,
}: {
  label: string;
  onAdd?: () => void;
  addLabel?: string;
  disabled?: boolean;
}) {
  return (
    <View style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={[s.fieldLabel, { paddingRight: onAdd ? 84 : 0 }]}>
        {label}
      </Text>
      {onAdd && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={addLabel ?? 'Thêm mới'}
          accessibilityState={{ disabled }}
          disabled={disabled}
          hitSlop={12}
          onPress={onAdd}
          style={({ pressed }) => ({
            position: 'absolute',
            right: 0,
            top: 0,
            minHeight: 48,
            minWidth: 84,
            justifyContent: 'center',
            paddingHorizontal: 8,
            opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
          })}
        >
          <Text style={[s.fieldLabel, { color: colors.primary }]}>
            Thêm mới
          </Text>
        </Pressable>
      )}
    </View>
  );
}

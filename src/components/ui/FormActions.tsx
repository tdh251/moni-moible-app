import { Keyboard, View } from 'react-native';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { PrimaryButton, TextButton, s } from './index';

export function FormActions({
  onCancel,
  onSave,
  busy = false,
  saveDisabled = false,
  saveLabel = 'Lưu',
  showCancel = true,
}: {
  onCancel: () => void;
  onSave: () => void;
  busy?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
  showCancel?: boolean;
}) {
  const { largeText } = useResponsiveLayout();
  return (
    <View
      style={[
        s.row,
        largeText && { flexDirection: 'column-reverse', alignItems: 'stretch' },
      ]}
    >
      {showCancel && (
        <View>
          <TextButton
            label="Hủy"
            disabled={busy}
            onPress={() => {
              Keyboard.dismiss();
              onCancel();
            }}
          />
        </View>
      )}
      <View style={{ flex: largeText ? undefined : 1 }}>
        <PrimaryButton
          label={busy ? 'Đang lưu…' : saveLabel}
          disabled={busy || saveDisabled}
          loading={busy}
          onPress={() => {
            Keyboard.dismiss();
            onSave();
          }}
        />
      </View>
    </View>
  );
}

import { Keyboard, View } from 'react-native';
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
  return (
    <View style={s.row}>
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
      <View style={{ flex: 1 }}>
        <PrimaryButton
          label={busy ? 'Đang lưu…' : saveLabel}
          disabled={busy || saveDisabled}
          onPress={() => {
            Keyboard.dismiss();
            onSave();
          }}
        />
      </View>
    </View>
  );
}

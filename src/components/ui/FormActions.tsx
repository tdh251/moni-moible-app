import { Keyboard, View } from 'react-native';
import { PrimaryButton, SecondaryButton, s } from './index';

export function FormActions({
  onCancel,
  onSave,
  busy = false,
  saveDisabled = false,
  saveLabel = 'Lưu',
}: {
  onCancel: () => void;
  onSave: () => void;
  busy?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
}) {
  return (
    <View style={[s.row, { justifyContent: 'flex-end' }]}>
      <View style={{ minWidth: 100 }}>
        <SecondaryButton
          label="Hủy"
          disabled={busy}
          onPress={() => {
            Keyboard.dismiss();
            onCancel();
          }}
        />
      </View>
      <View style={{ minWidth: 100 }}>
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

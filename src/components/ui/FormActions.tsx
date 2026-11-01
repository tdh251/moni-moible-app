import { Keyboard, View } from 'react-native';
import { PrimaryButton, SecondaryButton, s } from './index';

export function FormActions({
  onCancel,
  onSave,
  busy = false,
}: {
  onCancel: () => void;
  onSave: () => void;
  busy?: boolean;
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
          label={busy ? 'Đang lưu…' : 'Lưu'}
          disabled={busy}
          onPress={onSave}
        />
      </View>
    </View>
  );
}

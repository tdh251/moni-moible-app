import { Alert } from 'react-native';
export interface ConfirmationRequest {
  title: string;
  message: string;
  danger: boolean;
  resolve: (value: boolean) => void;
}
let present: ((request: ConfirmationRequest) => void) | null = null;
export function registerConfirmationPresenter(value: typeof present) {
  present = value;
}
export function requestConfirmation(
  title: string,
  message: string,
  danger = false,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (present) present({ title, message, danger, resolve });
    else
      Alert.alert(
        title,
        message,
        [
          { text: 'Hủy', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Xác nhận',
            style: danger ? 'destructive' : 'default',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
  });
}

import { FloatingActionButton } from './FloatingActionButton';

export function FloatingAddButton({
  visible,
  label,
  hint,
  onPress,
  disabled = false,
}: {
  visible: boolean;
  label: string;
  hint: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <FloatingActionButton
      icon="add-outline"
      visible={visible}
      label={label}
      hint={hint}
      disabled={disabled}
      onPress={onPress}
    />
  );
}

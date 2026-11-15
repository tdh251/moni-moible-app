import { FloatingActionButton } from './FloatingActionButton';

export function FloatingAddButton({
  label,
  hint,
  onPress,
  disabled = false,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <FloatingActionButton
      icon="add-outline"
      text="Thêm"
      label={label}
      hint={hint}
      disabled={disabled}
      onPress={onPress}
    />
  );
}

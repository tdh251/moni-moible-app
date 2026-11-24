import { useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, Text } from 'react-native';
import { Icon, IconButton, s, type IconName } from './index';
import { BottomSheet } from './BottomSheet';
import { MotionPressable } from './MotionPressable';
import { colors, radius, spacing } from '../../theme';
interface Action {
  label: string;
  icon: IconName;
  danger?: boolean;
  onPress: () => void;
}
export function ActionMenu({
  label,
  actions,
  disabled = false,
}: {
  label: string;
  actions: Action[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const close = () => {
    pending.current = null;
    setOpen(false);
  };
  const runPending = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };
  return (
    <>
      <IconButton
        label={label}
        icon="ellipsis-horizontal"
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
      />
      <BottomSheet
        visible={open}
        title={label}
        onClose={close}
        onDismiss={runPending}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: spacing.sm }}
        >
          {actions.map((action) => (
            <MotionPressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              disabled={disabled}
              style={[
                s.row,
                {
                  minHeight: 48,
                  borderRadius: radius.icon,
                  padding: spacing.compact,
                },
              ]}
              onPress={() => {
                pending.current = action.onPress;
                setOpen(false);
                if (Platform.OS !== 'ios') requestAnimationFrame(runPending);
              }}
            >
              <Icon
                name={action.icon}
                size={20}
                color={action.danger ? colors.danger : colors.primary}
              />
              <Text
                style={[
                  s.text,
                  {
                    flex: 1,
                    minWidth: 0,
                    color: action.danger ? colors.danger : colors.text,
                  },
                ]}
              >
                {action.label}
              </Text>
            </MotionPressable>
          ))}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

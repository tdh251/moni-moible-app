import { useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, IconButton, s, type IconName } from './index';
import { MotionPressable } from './MotionPressable';
import { colors, layout } from '../../theme';
import { useReducedMotionPreference } from '../../hooks/motion';

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
  const reducedMotion = useReducedMotionPreference();
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
      <Modal
        visible={open}
        transparent
        animationType={reducedMotion ? 'none' : 'fade'}
        onRequestClose={close}
        onDismiss={runPending}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(25,56,44,0.35)' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng menu thao tác"
            style={StyleSheet.absoluteFill}
            onPress={close}
          />
          <SafeAreaView
            pointerEvents="box-none"
            style={{ flex: 1, justifyContent: 'flex-end', padding: 20 }}
          >
            <View
              accessibilityViewIsModal
              style={{
                backgroundColor: colors.card,
                borderRadius: 22,
                padding: 12,
                width: '100%',
                maxWidth: layout.contentWidth,
                alignSelf: 'center',
              }}
            >
              <View style={[s.between, { paddingLeft: 12 }]}>
                <Text
                  accessibilityRole="header"
                  style={[s.heading, { flex: 1 }]}
                >
                  {label}
                </Text>
                <IconButton
                  label="Đóng menu thao tác"
                  icon="close-outline"
                  onPress={close}
                />
              </View>
              {actions.map((action) => (
                <MotionPressable
                  key={action.label}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  disabled={disabled}
                  style={[
                    s.row,
                    { minHeight: 56, borderRadius: 14, padding: 12 },
                  ]}
                  onPress={() => {
                    pending.current = action.onPress;
                    setOpen(false);
                    // iOS must finish dismissing this modal before presenting
                    // another modal or a native confirmation alert.
                    if (Platform.OS !== 'ios')
                      requestAnimationFrame(runPending);
                  }}
                >
                  <Icon
                    name={action.icon}
                    color={action.danger ? colors.danger : colors.primary}
                  />
                  <Text
                    style={[
                      s.text,
                      {
                        flex: 1,
                        color: action.danger ? colors.danger : colors.text,
                      },
                    ]}
                  >
                    {action.label}
                  </Text>
                </MotionPressable>
              ))}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

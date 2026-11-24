import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, s } from './index';
import {
  colors,
  elevation,
  layout,
  radius,
  spacing,
  typography,
} from '../../theme';
import { useReducedMotionPreference } from '../../hooks/motion';

export function BottomSheet({
  visible = true,
  title,
  children,
  footer,
  onClose,
  onDismiss,
  closeDisabled = false,
}: {
  visible?: boolean;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  onDismiss?: () => void;
  closeDisabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotionPreference();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={() => {
        if (!closeDisabled) onClose();
      }}
      onDismiss={onDismiss}
    >
      <View style={{ flex: 1, backgroundColor: colors.overlay }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={`Đóng ${title.toLocaleLowerCase('vi-VN')}`}
          disabled={closeDisabled}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
          pointerEvents="box-none"
        >
          <View
            accessibilityViewIsModal
            style={{
              width: '100%',
              maxWidth: layout.contentWidth,
              maxHeight: Math.max(240, height - insets.top - spacing.md),
              alignSelf: 'center',
              backgroundColor: colors.card,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              paddingBottom: Math.max(insets.bottom, spacing.compact),
              ...elevation.sheet,
            }}
          >
            <View
              accessible={false}
              style={{
                width: 36,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: colors.border,
                alignSelf: 'center',
                marginTop: spacing.sm,
              }}
            />
            <View
              style={[
                s.row,
                {
                  paddingLeft: spacing.md,
                  paddingRight: spacing.xs,
                  paddingVertical: spacing.xs,
                },
              ]}
            >
              <Text
                accessibilityRole="header"
                style={[typography.section, { color: colors.text, flex: 1 }]}
              >
                {title}
              </Text>
              <IconButton
                label={`Đóng ${title.toLocaleLowerCase('vi-VN')}`}
                icon="close-outline"
                disabled={closeDisabled}
                onPress={onClose}
              />
            </View>
            <View style={{ flexShrink: 1, paddingHorizontal: spacing.md }}>
              {children}
            </View>
            {!!footer && (
              <View
                style={{
                  paddingHorizontal: spacing.md,
                  paddingTop: spacing.compact,
                  marginTop: spacing.sm,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                }}
              >
                {footer}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

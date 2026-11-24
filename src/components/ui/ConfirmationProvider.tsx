import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  registerConfirmationPresenter,
  type ConfirmationRequest,
} from './confirmation';
import { Icon, PrimaryButton, SecondaryButton, s } from './index';
import { colors, layout, radius, spacing, typography } from '../../theme';
import { useReducedMotionPreference } from '../../hooks/motion';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

export function ConfirmationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const queue = useRef<ConfirmationRequest[]>([]);
  const active = useRef<ConfirmationRequest | null>(null);
  const reducedMotion = useReducedMotionPreference();
  const { stack } = useResponsiveLayout();
  useEffect(() => {
    const pendingQueue = queue.current;
    registerConfirmationPresenter((next) => {
      queue.current.push(next);
      if (!active.current) {
        active.current = queue.current.shift()!;
        setRequest(active.current);
      }
    });
    return () => {
      registerConfirmationPresenter(null);
      active.current?.resolve(false);
      pendingQueue.splice(0).forEach((item) => item.resolve(false));
      active.current = null;
    };
  }, []);
  const finish = (confirmed: boolean) => {
    const previous = active.current;
    active.current = queue.current.shift() ?? null;
    setRequest(active.current);
    previous?.resolve(confirmed);
  };
  return (
    <>
      {children}
      <Modal
        visible={!!request}
        transparent
        animationType={reducedMotion ? 'none' : 'fade'}
        onRequestClose={() => finish(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            padding: spacing.comfortable,
            justifyContent: 'center',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hủy xác nhận"
            style={StyleSheet.absoluteFill}
            onPress={() => finish(false)}
          />
          {request && (
            <View
              accessibilityViewIsModal
              style={{
                width: '100%',
                maxWidth: Math.min(layout.contentWidth, 440),
                maxHeight: '85%',
                alignSelf: 'center',
                backgroundColor: colors.card,
                borderRadius: radius.sheet,
                padding: spacing.comfortable,
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: request.danger
                    ? colors.dangerLight
                    : colors.brandMuted,
                  borderRadius: radius.icon,
                  padding: spacing.compact,
                }}
              >
                <Icon
                  name={
                    request.danger
                      ? 'alert-circle-outline'
                      : 'help-circle-outline'
                  }
                  color={request.danger ? colors.danger : colors.primary}
                  size={26}
                />
              </View>
              <Text
                accessibilityRole="header"
                style={[typography.section, { color: colors.text }]}
              >
                {request.title}
              </Text>
              <ScrollView style={{ flexShrink: 1 }}>
                <Text style={s.text}>{request.message}</Text>
              </ScrollView>
              <View
                style={{
                  flexDirection: stack ? 'column-reverse' : 'row',
                  gap: spacing.sm,
                }}
              >
                <View style={{ flex: stack ? undefined : 1 }}>
                  <SecondaryButton label="Hủy" onPress={() => finish(false)} />
                </View>
                <View style={{ flex: stack ? undefined : 1 }}>
                  <PrimaryButton
                    label="Xác nhận"
                    danger={request.danger}
                    onPress={() => finish(true)}
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

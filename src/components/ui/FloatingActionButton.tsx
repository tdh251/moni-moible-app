import { useEffect } from 'react';
import { Keyboard, Text } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Icon, type IconName } from './index';
import { colors, layout } from '../../theme';
import { motion } from '../../theme/motion';
import { useReducedMotionPreference } from '../../hooks/motion';
import { MotionPressable } from './MotionPressable';

export function FloatingActionButton({
  visible = true,
  label,
  hint,
  icon,
  onPress,
  disabled = false,
  text,
}: {
  visible?: boolean;
  label: string;
  hint: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  text?: string;
}) {
  const progress = useSharedValue(visible ? 1 : 0);
  const reducedMotion = useReducedMotionPreference();
  useEffect(() => {
    progress.set(
      withTiming(visible ? 1 : 0, {
        duration: reducedMotion ? 0 : motion.transition,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [progress, visible, reducedMotion]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [
      { scale: reducedMotion ? 1 : 0.9 + progress.get() * 0.1 },
      { translateY: reducedMotion ? 0 : (1 - progress.get()) * 12 },
    ],
  }));
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[
        {
          position: 'absolute',
          right: layout.screenPadding,
          bottom: layout.floatingButtonBottom,
        },
        animatedStyle,
      ]}
    >
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          onPress();
        }}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: layout.floatingButtonSize,
          width: text ? undefined : layout.floatingButtonSize,
          paddingHorizontal: text ? 18 : 0,
          flexDirection: 'row',
          gap: 8,
          height: layout.floatingButtonSize,
          borderRadius: layout.floatingButtonSize / 2,
          backgroundColor: colors.primary,
          elevation: 5,
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
        }}
      >
        <Icon name={icon} color={colors.onPrimary} size={24} />
        {text && (
          <Text
            style={{ color: colors.onPrimary, fontSize: 15, fontWeight: '600' }}
          >
            {text}
          </Text>
        )}
      </MotionPressable>
    </Animated.View>
  );
}

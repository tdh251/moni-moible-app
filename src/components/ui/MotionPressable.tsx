import { useEffect } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotionPreference } from '../../hooks/motion';
import { motion } from '../../theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MotionPressable({
  style,
  disabled = false,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotionPreference();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (disabled || reducedMotion) progress.set(0);
  }, [disabled, reducedMotion, progress]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0.45 : 1 - progress.get() * 0.16,
    transform: [{ scale: reducedMotion ? 1 : 1 - progress.get() * 0.025 }],
  }));
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        progress.set(
          withTiming(1, {
            duration: reducedMotion ? 0 : motion.press,
            reduceMotion: ReduceMotion.System,
          }),
        );
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        progress.set(
          withTiming(0, {
            duration: reducedMotion ? 0 : motion.release,
            reduceMotion: ReduceMotion.System,
          }),
        );
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    />
  );
}

import type { ViewProps } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useReducedMotionPreference } from '../../hooks/motion';
import { motion } from '../../theme/motion';

const entering = FadeIn.duration(motion.transition).reduceMotion(
  ReduceMotion.System,
);

export function MotionSection(props: ViewProps) {
  const reducedMotion = useReducedMotionPreference();
  return (
    <Animated.View {...props} entering={reducedMotion ? undefined : entering} />
  );
}

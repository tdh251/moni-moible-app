import { useEffect, useState } from 'react';
import { Animated, Keyboard, Pressable } from 'react-native';
import { Icon, type IconName } from './index';
import { colors, layout } from '../../theme';

export function FloatingActionButton({
  visible = true,
  label,
  hint,
  icon,
  onPress,
  disabled = false,
}: {
  visible?: boolean;
  label: string;
  hint: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
}) {
  const [progress] = useState(() => new Animated.Value(visible ? 1 : 0));
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, visible]);
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={{
        position: 'absolute',
        right: layout.screenPadding,
        bottom: layout.floatingButtonBottom,
        opacity: progress,
        transform: [{ scale: progress }],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          onPress();
        }}
        style={({ pressed }) => ({
          alignItems: 'center',
          justifyContent: 'center',
          width: layout.floatingButtonSize,
          height: layout.floatingButtonSize,
          borderRadius: layout.floatingButtonSize / 2,
          backgroundColor: colors.primary,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          elevation: 5,
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
        })}
      >
        <Icon name={icon} color={colors.onPrimary} size={28} />
      </Pressable>
    </Animated.View>
  );
}

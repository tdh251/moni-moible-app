import { useEffect, useState } from 'react';
import { Animated, Keyboard, Pressable } from 'react-native';
import { Icon } from './index';
import { colors } from '../../theme';

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
  const [progress] = useState(() => new Animated.Value(1));
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
        right: 20,
        bottom: 16,
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
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          elevation: 5,
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
        })}
      >
        <Icon name="add-outline" color="#FFFFFF" size={28} />
      </Pressable>
    </Animated.View>
  );
}

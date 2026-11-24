import { useId, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { Amount, AppCard, Icon, s } from './index';
import { MotionPressable } from './MotionPressable';
import { colors, elevation, radius, spacing, typography } from '../../theme';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

export function SectionHeader({
  title,
  subtitle,
  action,
  onPress,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={[s.between, { gap: spacing.sm }]}>
      <View style={{ flex: 1, minWidth: 130, gap: spacing.xs }}>
        <Text
          accessibilityRole="header"
          style={[typography.section, { color: colors.text }]}
        >
          {title}
        </Text>
        {!!subtitle && <Text style={s.muted}>{subtitle}</Text>}
      </View>
      {!!action && onPress && (
        <MotionPressable
          accessibilityRole="button"
          onPress={onPress}
          style={s.textAction}
        >
          <Text style={s.textActionLabel}>{action}</Text>
        </MotionPressable>
      )}
    </View>
  );
}

export function HeroCard({
  label,
  value,
  subtitle,
  children,
  rightAction,
  reveal = false,
}: {
  label: string;
  value: number;
  subtitle?: string;
  children?: React.ReactNode;
  rightAction?: React.ReactNode;
  reveal?: boolean;
}) {
  const gradient = 'moniHero' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const { compact } = useResponsiveLayout();
  return (
    <View style={[styles.hero, elevation.hero]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { overflow: 'hidden', borderRadius: radius.hero },
        ]}
        accessible={false}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 400 230"
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.heroStart} />
              <Stop offset="0.5" stopColor={colors.heroMiddle} />
              <Stop offset="1" stopColor={colors.heroEnd} />
            </LinearGradient>
          </Defs>
          <Rect width="400" height="230" fill={`url(#${gradient})`} />
          <Circle cx="386" cy="16" r="114" fill="white" opacity="0.035" />
          <Circle
            cx="386"
            cy="16"
            r="78"
            stroke="white"
            strokeWidth="1"
            fill="none"
            opacity="0.13"
          />
          <Path
            d="M235 230 Q290 88 435 106"
            stroke="white"
            strokeWidth="34"
            opacity="0.035"
            fill="none"
          />
        </Svg>
      </View>
      <View style={[s.between, { flexWrap: 'nowrap' }]}>
        <Text
          style={[typography.label, { color: colors.onDarkMuted, flex: 1 }]}
        >
          {label}
        </Text>
        {rightAction}
      </View>
      <Amount
        value={value}
        reveal={reveal}
        style={[
          typography.hero,
          {
            color: colors.onDark,
            textAlign: 'left',
            fontSize: compact ? 28 : 34,
            lineHeight: compact ? 40 : 44,
          },
        ]}
      />
      {!!subtitle && (
        <Text style={[typography.caption, { color: colors.onDarkMuted }]}>
          {subtitle}
        </Text>
      )}
      {children}
    </View>
  );
}

export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger' | 'brand';
}) {
  const palette = {
    neutral: [colors.surfaceSecondary, colors.muted],
    positive: [colors.incomeLight, colors.income],
    warning: [colors.warningLight, colors.warning],
    danger: [colors.dangerLight, colors.danger],
    brand: [colors.light, colors.primary],
  }[tone];
  return (
    <View
      style={{
        backgroundColor: palette[0],
        borderRadius: radius.small,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        alignSelf: 'flex-start',
        maxWidth: '100%',
      }}
    >
      <Text
        style={[typography.caption, { color: palette[1], fontWeight: '500' }]}
      >
        {label}
      </Text>
    </View>
  );
}

export function MoneyRow({
  label,
  value,
  tone,
  labelTone,
  strong = false,
  reveal = false,
}: {
  label: string;
  value: number;
  tone?: string;
  labelTone?: string;
  strong?: boolean;
  reveal?: boolean;
}) {
  const { stack } = useResponsiveLayout();
  return (
    <View
      style={{
        flexDirection: stack ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: stack ? 'stretch' : 'center',
        gap: stack ? spacing.xs : spacing.compact,
      }}
    >
      <Text
        style={[
          strong ? s.text : s.muted,
          { flex: stack ? undefined : 1, minWidth: 0 },
          labelTone ? { color: labelTone } : undefined,
        ]}
      >
        {label}
      </Text>
      <Amount
        value={value}
        reveal={reveal}
        style={{
          color: tone ?? colors.text,
          textAlign: 'right',
          fontWeight: strong ? '700' : '600',
        }}
      />
    </View>
  );
}

export function SummaryCard({
  label,
  value,
  kind,
  style,
}: {
  label: string;
  value: number;
  kind: 'income' | 'expense' | 'neutral';
  style?: StyleProp<ViewStyle>;
}) {
  const color =
    kind === 'income'
      ? colors.income
      : kind === 'expense'
        ? colors.expense
        : colors.text;
  return (
    <AppCard style={style}>
      <View style={[s.row, { gap: spacing.sm }]}>
        <Icon
          name={
            kind === 'income'
              ? 'arrow-down-outline'
              : kind === 'expense'
                ? 'arrow-up-outline'
                : 'swap-horizontal-outline'
          }
          size={17}
          color={color}
        />
        <Text style={s.muted}>{label}</Text>
      </View>
      <Amount value={value} style={{ color, textAlign: 'left' }} />
    </AppCard>
  );
}

export function AccountRow({
  name,
  type,
  value,
  onPress,
  reveal = false,
  archived = false,
}: {
  name: string;
  type: 'cash' | 'bank';
  value: number;
  onPress: () => void;
  reveal?: boolean;
  archived?: boolean;
}) {
  const { stack } = useResponsiveLayout();
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={`Tài khoản ${name}`}
      onPress={onPress}
      style={styles.accountRow}
    >
      <View style={styles.iconWell}>
        <Icon name={type === 'cash' ? 'wallet-outline' : 'card-outline'} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
        <Text style={[s.text, { fontWeight: '500' }]}>{name}</Text>
        {archived && <Text style={s.muted}>Đã lưu trữ</Text>}
        {stack && (
          <Amount value={value} reveal={reveal} style={{ textAlign: 'left' }} />
        )}
      </View>
      {!stack && (
        <Amount value={value} reveal={reveal} style={{ maxWidth: '52%' }} />
      )}
      <Icon name="chevron-forward-outline" size={16} color={colors.muted} />
    </MotionPressable>
  );
}

export function Disclosure({
  title,
  subtitle,
  children,
  defaultOpen = false,
  active = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  active?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={{ gap: spacing.compact }}>
      <MotionPressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.text, { fontWeight: '600' }]}>
            {title}
            {active ? ' · Đang áp dụng' : ''}
          </Text>
          {!!subtitle && <Text style={s.muted}>{subtitle}</Text>}
        </View>
        <Icon
          name={open ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={18}
        />
      </MotionPressable>
      <View
        style={{ gap: spacing.compact, display: open ? 'flex' : 'none' }}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      >
        {children}
      </View>
    </View>
  );
}

export function ProgressBar({
  value,
  label,
  light = false,
}: {
  value: number;
  label: string;
  light?: boolean;
}) {
  const ratio = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={{
        height: 6,
        borderRadius: radius.pill,
        backgroundColor: light ? '#FFFFFF30' : colors.border,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${ratio * 100}%`,
          borderRadius: radius.pill,
          backgroundColor: light ? colors.onDark : colors.primary,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.hero,
    backgroundColor: colors.balance,
    padding: spacing.comfortable,
    gap: spacing.sm,
  },
  accountRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.compact,
    paddingVertical: spacing.compact,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: radius.icon,
    backgroundColor: colors.brandMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

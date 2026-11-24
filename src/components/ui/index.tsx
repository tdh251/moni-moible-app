import { TagBadges } from '../../features/tags/TagBadges';
import { transactionCategoryTags } from '../../services/categories/tags';
import { categoryPath } from '../../services/categories/hierarchy';
import React, { memo, useId, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ColorValue,
  type TextInputProps,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import {
  colors,
  elevation,
  layout,
  radius,
  spacing,
  typography,
} from '../../theme';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { Dropdown } from './Dropdown';
import { MotionPressable } from './MotionPressable';
import { requestConfirmation } from './confirmation';
import type { TransactionListIndex } from '../../services/transaction-list';
import { usePreferences } from '../../stores/preferences';
import { formatVnd, typeNames } from '../../utils/format';
import type { Account, Category, Transaction } from '../../types/finance';

export type IconName = keyof typeof Ionicons.glyphMap;
export function Icon({
  name,
  size = 22,
  color = colors.primary,
}: {
  name: string;
  size?: number;
  color?: ColorValue;
}) {
  const safeName: IconName =
    name in Ionicons.glyphMap ? (name as IconName) : 'ellipse-outline';
  return (
    <Ionicons
      name={safeName}
      size={size}
      color={
        typeof color === 'number' ? colors.primary : (color ?? colors.primary)
      }
    />
  );
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: layout.screenPadding,
    gap: spacing.md,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: layout.contentWidth,
    alignSelf: 'center',
  },
  title: { ...typography.page, color: colors.text },
  heading: { ...typography.card, color: colors.text },
  text: { ...typography.body, color: colors.text },
  muted: { ...typography.label, color: colors.muted },
  card: {
    ...elevation.card,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.compact,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.compact },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.compact,
    flexWrap: 'wrap',
  },
  button: {
    minHeight: 48,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.compact,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.primary,
  },
  buttonText: {
    ...typography.button,
    color: colors.onPrimary,
    textAlign: 'center',
    flexShrink: 1,
  },
  secondary: {
    backgroundColor: colors.brandMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: spacing.compact,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    backgroundColor: colors.card,
  },
  label: { ...typography.label, color: colors.muted, marginBottom: spacing.xs },
  fieldGroup: { gap: spacing.sm },
  selectGroup: { gap: spacing.sm },
  fieldLabel: { ...typography.label, color: colors.muted },
  pill: {
    minHeight: 44,
    maxWidth: '100%',
    paddingHorizontal: spacing.compact,
    paddingVertical: spacing.sm,
    borderRadius: radius.small,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selected: { backgroundColor: colors.light, borderColor: colors.primary },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  listContent: { paddingBottom: layout.floatingContentPadding },
  iconButton: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    borderRadius: radius.icon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  textActionLabel: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
});
export function IconButton({
  label,
  icon,
  onPress,
  disabled = false,
  danger = false,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={s.iconButton}
    >
      <Icon name={icon} color={danger ? colors.danger : colors.primary} />
    </MotionPressable>
  );
}
export function AppHeader({
  rightAction,
  title,
  subtitle,
  back = false,
  onClose,
  closeDisabled = false,
  onBack,
  backDisabled = false,
}: {
  rightAction?: React.ReactNode;
  title: string;
  subtitle?: string;
  back?: boolean;
  onClose?: () => void;
  closeDisabled?: boolean;
  onBack?: () => void;
  backDisabled?: boolean;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={[s.between, { flexWrap: 'nowrap', gap: spacing.sm }]}>
        {back && (
          <IconButton
            label="Quay lại"
            icon="arrow-back-outline"
            disabled={backDisabled}
            onPress={() => {
              Keyboard.dismiss();
              if (onBack) onBack();
              else if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
          />
        )}
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={[
            back || onClose ? typography.detail : typography.page,
            { color: colors.text, flex: 1, minWidth: 0 },
          ]}
        >
          {title}
        </Text>
        {onClose && (
          <IconButton
            label="Đóng popup"
            icon="close-outline"
            disabled={closeDisabled}
            onPress={() => {
              Keyboard.dismiss();
              onClose();
            }}
          />
        )}
        {rightAction}
      </View>
      {subtitle && (
        <Text style={[s.muted, { paddingLeft: back ? 56 : 0 }]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}
const ScreenBackdrop = memo(function ScreenBackdrop() {
  const id = 'moniBackdrop' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '100%',
        height: 480,
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 430 480"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id={id} x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#CCE5D9" stopOpacity="0.6" />
            <Stop offset="1" stopColor={colors.background} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path
          d="M430 0 L430 480 L30 480 Q150 100 430 24 Z"
          fill={`url(#${id})`}
        />
      </Svg>
    </View>
  );
});
export function ScreenContainer({
  floatingAction,
  rightAction,
  title,
  subtitle,
  back,
  children,
  scroll = true,
  onClose,
  closeDisabled = false,
  tabScreen = false,
  footer,
  onBack,
  backDisabled = false,
}: {
  floatingAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  title: string;
  subtitle?: string;
  back?: boolean;
  children: React.ReactNode;
  scroll?: boolean;
  onClose?: () => void;
  closeDisabled?: boolean;
  tabScreen?: boolean;
  footer?: React.ReactNode;
  onBack?: () => void;
  backDisabled?: boolean;
}) {
  return (
    <SafeAreaView
      style={s.screen}
      edges={
        tabScreen
          ? ['top', 'left', 'right']
          : ['top', 'left', 'right', 'bottom']
      }
    >
      <ScreenBackdrop />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={{
            paddingHorizontal: layout.screenPadding,
            paddingTop: spacing.sm,
            paddingBottom: spacing.compact,
            width: '100%',
            maxWidth: layout.contentWidth,
            alignSelf: 'center',
          }}
        >
          <AppHeader
            rightAction={rightAction}
            title={title}
            subtitle={subtitle}
            back={back}
            onBack={onBack}
            backDisabled={backDisabled}
            onClose={onClose}
            closeDisabled={closeDisabled}
          />
        </View>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              s.content,
              { paddingTop: 0 },
              floatingAction ? s.listContent : undefined,
            ]}
          >
            {children}
          </ScrollView>
        ) : (
          <View
            style={[s.content, { flex: 1, paddingTop: 0, paddingBottom: 0 }]}
          >
            {children}
          </View>
        )}
        {footer && (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <View
              style={{
                paddingHorizontal: layout.screenPadding,
                paddingVertical: spacing.compact,
                width: '100%',
                maxWidth: layout.contentWidth,
                alignSelf: 'center',
              }}
            >
              {footer}
            </View>
          </View>
        )}
        {floatingAction && (
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '100%',
              maxWidth: layout.contentWidth,
              alignSelf: 'center',
            }}
          >
            {floatingAction}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function AppCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}
interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: string;
  danger?: boolean;
  loading?: boolean;
  description?: string;
}
export function TextButton({ label, onPress, disabled, danger }: ButtonProps) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: layout.touchTarget,
        paddingHorizontal: 8,
        justifyContent: 'center',
      }}
    >
      <Text style={[s.textActionLabel, danger && { color: colors.danger }]}>
        {label}
      </Text>
    </MotionPressable>
  );
}

export function NavigationRow({
  label,
  icon,
  onPress,
  disabled,
  description,
  danger,
}: ButtonProps) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.row,
        {
          minHeight: 60,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.compact,
        },
      ]}
    >
      {icon && (
        <View
          style={{
            backgroundColor: danger ? colors.dangerLight : colors.brandMuted,
            borderRadius: radius.icon,
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            name={icon}
            size={20}
            color={danger ? colors.danger : colors.primary}
          />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
        <Text
          style={[
            s.text,
            { fontWeight: '500', color: danger ? colors.danger : colors.text },
          ]}
        >
          {label}
        </Text>
        {description && <Text style={s.muted}>{description}</Text>}
      </View>
      <Icon name="chevron-forward-outline" size={18} color={colors.muted} />
    </MotionPressable>
  );
}
export function PrimaryButton({
  label,
  onPress,
  disabled,
  icon,
  danger,
  loading = false,
}: ButtonProps) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[s.button, danger && { backgroundColor: colors.danger }]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} size="small" />
      ) : (
        icon && <Icon name={icon} color={colors.onPrimary} size={20} />
      )}
      <Text style={s.buttonText}>{label}</Text>
    </MotionPressable>
  );
}
export function SecondaryButton({
  label,
  onPress,
  disabled,
  icon,
  danger,
}: ButtonProps) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, s.secondary, danger && s.danger]}
    >
      {icon && (
        <Icon name={icon} color={danger ? colors.danger : colors.primary} />
      )}
      <Text
        style={[
          s.buttonText,
          { color: danger ? colors.danger : colors.primary },
        ]}
      >
        {label}
      </Text>
    </MotionPressable>
  );
}
export function Field({
  label,
  error,
  hint,
  leadingIcon,
  hideLabel = false,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  leadingIcon?: string;
  hideLabel?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.fieldGroup}>
      {!hideLabel && <Text style={s.fieldLabel}>{label}</Text>}
      <View
        style={{
          flexDirection: 'row',
          alignItems: props.multiline ? 'flex-start' : 'center',
          gap: spacing.sm,
          paddingHorizontal: 14,
          borderRadius: radius.input,
          borderWidth: 1,
          borderColor: error
            ? colors.danger
            : focused
              ? colors.primary
              : colors.border,
          backgroundColor:
            props.editable === false ? colors.surfaceSecondary : colors.card,
        }}
      >
        {leadingIcon && (
          <Icon name={leadingIcon} size={20} color={colors.muted} />
        )}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.placeholder}
          {...props}
          accessibilityHint={error ?? hint ?? props.accessibilityHint}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={[
            s.field,
            {
              flex: 1,
              minWidth: 0,
              borderWidth: 0,
              backgroundColor: 'transparent',
              paddingHorizontal: 0,
            },
            props.multiline && { minHeight: 88, textAlignVertical: 'top' },
            props.style,
          ]}
        />
      </View>
      {!!(error || hint) && (
        <Text
          accessibilityLiveRegion="polite"
          style={[s.muted, error ? { color: colors.danger } : undefined]}
        >
          {error || hint}
        </Text>
      )}
    </View>
  );
}
export function SearchField(props: TextInputProps & { label: string }) {
  return (
    <Field
      {...props}
      leadingIcon="search-outline"
      hideLabel
      returnKeyType="search"
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}
export function AmountInput({
  label = 'Số tiền (VND)',
  value,
  onChangeText,
  showHint = true,
  prominent = false,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  showHint?: boolean;
  prominent?: boolean;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Field
        label={label}
        keyboardType="number-pad"
        value={value}
        onChangeText={onChangeText}
        maxLength={16}
        placeholder="0"
        style={{
          fontSize: prominent ? 28 : 20,
          lineHeight: prominent ? 38 : 28,
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
          paddingVertical: spacing.sm,
        }}
      />
      {showHint && (
        <Text style={s.muted}>
          {/^\d+$/.test(value) && Number.isSafeInteger(Number(value))
            ? formatVnd(Number(value))
            : 'Nhập số nguyên, không dùng dấu phân cách'}
        </Text>
      )}
    </View>
  );
}
export function Amount({
  value,
  style,
  reveal = false,
}: {
  value: number;
  style?: React.ComponentProps<typeof Text>['style'];
  reveal?: boolean;
}) {
  const hidden = usePreferences((v) => v.hidden);
  return (
    <Text
      style={[
        typography.amount,
        { color: colors.text, maxWidth: '100%', textAlign: 'right' },
        style,
      ]}
    >
      {hidden && !reveal ? '••••••' : formatVnd(value)}
    </Text>
  );
}
export function Choices<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={s.wrap}>
      {options.map((o) => (
        <MotionPressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: o.value === value }}
          style={[s.pill, o.value === value && s.selected]}
          onPress={() => onChange(o.value)}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              flexShrink: 1,
            }}
          >
            {o.icon && <Icon name={o.icon} size={17} />}
            <Text
              style={{
                color: o.value === value ? colors.primary : colors.muted,
                fontSize: 13,
                lineHeight: 20,
                fontWeight: '500',
                flexShrink: 1,
              }}
            >
              {o.label}
            </Text>
          </View>
        </MotionPressable>
      ))}
    </View>
  );
}
export function AccountPicker({
  accounts,
  value,
  onChange,
  label = 'Tài khoản',
  all = false,
  variant = 'chips',
}: {
  accounts: Account[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  all?: boolean;
  variant?: 'chips' | 'dropdown';
}) {
  const options = [
    ...(all ? [{ value: '', label: 'Tất cả' }] : []),
    ...accounts.map((a) => ({
      value: a.id,
      label: `${a.name}${a.is_archived ? ' · lưu trữ' : ''}`,
      icon: a.type === 'cash' ? 'wallet-outline' : 'card-outline',
    })),
  ];
  return (
    <View style={s.selectGroup}>
      <Text style={s.fieldLabel}>{label}</Text>
      {variant === 'dropdown' ? (
        <Dropdown
          label={label}
          placeholder="Chọn tài khoản"
          options={options}
          value={value}
          onChange={onChange}
        />
      ) : (
        <Choices value={value} onChange={onChange} options={options} />
      )}
      {accounts.length === 0 && (
        <Text style={s.muted}>Chưa có tài khoản phù hợp.</Text>
      )}
    </View>
  );
}
export function CategoryPicker({
  categories,
  value,
  onChange,
  all = false,
  variant = 'chips',
}: {
  categories: Category[];
  value: string;
  onChange: (v: string) => void;
  all?: boolean;
  variant?: 'chips' | 'dropdown';
}) {
  const options = [
    ...(all ? [{ value: '', label: 'Tất cả' }] : []),
    ...categories.map((c) => ({
      value: c.id,
      label: `${categoryPath(categories, c.id)}${c.is_archived ? ' · lưu trữ' : ''}`,
      icon: c.icon,
    })),
  ];
  return (
    <View style={s.selectGroup}>
      <Text style={s.fieldLabel}>Danh mục</Text>
      {variant === 'dropdown' ? (
        <Dropdown
          label="Danh mục"
          searchable
          placeholder="Chọn danh mục"
          options={options}
          value={value}
          onChange={onChange}
        />
      ) : (
        <Choices value={value} onChange={onChange} options={options} />
      )}
      {categories.length === 0 && (
        <Text style={s.muted}>Thêm danh mục trong Cá nhân → Danh mục.</Text>
      )}
    </View>
  );
}
export function EmptyState({
  title,
  description,
  icon = 'leaf-outline',
}: {
  title: string;
  description: string;
  icon?: string;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          backgroundColor: colors.brandMuted,
          padding: spacing.md,
          borderRadius: radius.card,
        }}
      >
        <Icon name={icon} size={26} />
      </View>
      <Text style={[s.heading, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[s.muted, { textAlign: 'center' }]}>{description}</Text>
    </View>
  );
}
export function LoadingState() {
  return (
    <SafeAreaView
      style={[
        s.screen,
        { justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ gap: spacing.md }}
      >
        <View
          style={{
            height: 28,
            width: '44%',
            borderRadius: radius.small,
            backgroundColor: colors.border,
          }}
        />
        <View
          style={{
            height: 164,
            borderRadius: radius.hero,
            backgroundColor: colors.light,
          }}
        />
        {[1, 2, 3].map((key) => (
          <View
            key={key}
            style={{
              height: 60,
              borderRadius: radius.card,
              backgroundColor: colors.surfaceSecondary,
            }}
          />
        ))}
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Đang mở sổ tiền"
        accessibilityState={{ busy: true }}
        style={[s.row, { justifyContent: 'center' }]}
      >
        <ActivityIndicator color={colors.primary} />
        <Text style={s.muted}>Đang mở sổ tiền…</Text>
      </View>
    </SafeAreaView>
  );
}
export function ConfirmationDialog(
  title: string,
  message: string,
  danger = false,
): Promise<boolean> {
  return requestConfirmation(title, message, danger);
}
export const TransactionRow = memo(function TransactionRow({
  transaction: t,
  index,
}: {
  transaction: Transaction;
  index: TransactionListIndex;
}) {
  const { stack } = useResponsiveLayout();
  const color =
    t.type === 'expense'
      ? colors.expense
      : t.type === 'income'
        ? colors.income
        : colors.transfer;
  const tags = transactionCategoryTags(t);
  const category = index.categories.get(t.category_id ?? '');
  const itemCount = index.itemCounts.get(t.id) ?? 0;
  const thirdPartyCase = index.thirdPartyReportCases.get(t.id);
  const categoryName = (id: string | null) =>
    index.categoryNames.get(id ?? '') ?? '';
  const name = (id: string | null) => index.accountNames.get(id ?? '') ?? '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${typeNames[t.type]}: ${t.title}`}
      onPress={() =>
        router.push(
          thirdPartyCase
            ? { pathname: '/third-party/[id]', params: { id: thirdPartyCase } }
            : { pathname: '/transaction/[id]', params: { id: t.id } },
        )
      }
      style={({ pressed }) => ({
        padding: spacing.compact,
        marginBottom: spacing.sm,
        backgroundColor: colors.card,
        borderRadius: radius.card,
        ...elevation.card,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={[s.row, { alignItems: 'flex-start' }]}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.icon,
            backgroundColor:
              t.type === 'expense'
                ? colors.expenseLight
                : t.type === 'income'
                  ? colors.incomeLight
                  : colors.transferLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            size={20}
            color={color}
            name={
              thirdPartyCase
                ? 'people-outline'
                : t.type === 'transfer'
                  ? 'swap-horizontal-outline'
                  : (category?.icon ?? 'receipt-outline')
            }
          />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
          <View
            style={{
              flexDirection: stack ? 'column' : 'row',
              alignItems: stack ? 'stretch' : 'flex-start',
              gap: spacing.sm,
            }}
          >
            <Text
              style={[
                s.text,
                { fontWeight: '500', flex: stack ? undefined : 1, minWidth: 0 },
              ]}
            >
              {t.title}
            </Text>
            <Amount
              value={t.type === 'expense' ? -t.amount : t.amount}
              style={{
                color,
                fontSize: 16,
                lineHeight: 24,
                maxWidth: stack ? '100%' : '54%',
                alignSelf: 'flex-end',
              }}
            />
          </View>
          <Text style={[s.muted, { fontSize: 12, lineHeight: 18 }]}>
            {t.type === 'transfer'
              ? `${name(t.source_account_id)} → ${name(t.destination_account_id)}`
              : `${thirdPartyCase ? 'Thu chi hộ · Quyết toán' : name(t.source_account_id ?? t.destination_account_id)} · ${tags.length ? tags.map(categoryName).join(' · ') : itemCount ? `${itemCount} ${t.category_split === 1 ? 'danh mục' : 'mục chi'}` : categoryName(category?.id ?? null)}`}
          </Text>
          <View style={[s.between, { gap: spacing.sm }]}>
            {t.exclude_from_balance === 1 && (
              <Text style={[typography.caption, { color: colors.primary }]}>
                Không tính số dư
              </Text>
            )}
            <Text
              style={[
                typography.caption,
                { color: colors.muted, marginLeft: 'auto' },
              ]}
            >
              {new Date(t.occurred_at).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <TagBadges transaction={t} tags={index.tags} />
        </View>
      </View>
    </Pressable>
  );
});

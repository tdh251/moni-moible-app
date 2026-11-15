import { TagBadges } from '../../features/tags/TagBadges';
import { transactionCategoryTags } from '../../services/categories/tags';
import { categoryPath } from '../../services/categories/hierarchy';
import React, { memo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ColorValue,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { colors, layout } from '../../theme';
import { Dropdown } from './Dropdown';
import { MotionPressable } from './MotionPressable';
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
    gap: layout.sectionGap,
    paddingBottom: 40,
    width: '100%',
    maxWidth: layout.contentWidth,
    alignSelf: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.8,
  },
  heading: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.text,
  },
  text: { fontSize: 15, color: colors.text, lineHeight: 23 },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    minHeight: 52,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onPrimary,
    textAlign: 'center',
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  field: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 7,
  },
  fieldGroup: { gap: 8 },
  selectGroup: { gap: 6 },
  fieldLabel: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.text,
  },
  pill: {
    minHeight: layout.touchTarget,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 13,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { backgroundColor: colors.light, borderColor: colors.primary },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  divider: { height: 1, backgroundColor: colors.border },
  listContent: { paddingBottom: layout.floatingContentPadding },
  iconButton: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textAction: { minHeight: layout.touchTarget, justifyContent: 'center' },
  textActionLabel: { color: colors.primary, fontSize: 14, fontWeight: '600' },
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
    <View style={{ gap: 6 }}>
      <View style={s.between}>
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
          style={[s.title, { flex: 1, fontSize: back ? 22 : 26 }]}
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
      {subtitle && <Text style={s.muted}>{subtitle}</Text>}
    </View>
  );
}
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View
          style={{
            paddingHorizontal: layout.screenPadding,
            paddingTop: 12,
            paddingBottom: layout.sectionGap,
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
                paddingVertical: 12,
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
  style?: ViewStyle;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}
interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: string;
  danger?: boolean;
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

export function NavigationRow({ label, icon, onPress, disabled }: ButtonProps) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.row,
        { minHeight: 64, paddingHorizontal: 20, paddingVertical: 12 },
      ]}
    >
      {icon && <Icon name={icon} />}
      <Text style={[s.text, { flex: 1, fontWeight: '600' }]}>{label}</Text>
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
}: ButtonProps) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, danger && s.danger]}
    >
      {icon && (
        <Icon name={icon} color={danger ? colors.danger : colors.onPrimary} />
      )}
      <Text style={[s.buttonText, danger && { color: colors.danger }]}>
        {label}
      </Text>
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
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={s.fieldGroup}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          s.field,
          props.multiline && { minHeight: 90, textAlignVertical: 'top' },
          props.style,
        ]}
      />
    </View>
  );
}
export function AmountInput({
  label = 'Số tiền (VND)',
  value,
  onChangeText,
  showHint = true,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  showHint?: boolean;
}) {
  return (
    <View>
      <Field
        label={label}
        keyboardType="number-pad"
        value={value}
        onChangeText={onChangeText}
        maxLength={16}
        placeholder="0"
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
        s.text,
        { fontWeight: '700', fontVariant: ['tabular-nums'] },
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {o.icon && <Icon name={o.icon} size={17} />}
            <Text
              style={{
                color: o.value === value ? colors.primary : colors.muted,
                fontSize: 13,
                fontWeight: '600',
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
    <View style={{ alignItems: 'center', padding: 28, gap: 10 }}>
      <View
        style={{ backgroundColor: colors.light, padding: 18, borderRadius: 24 }}
      >
        <Icon name={icon} size={30} />
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
        { alignItems: 'center', justifyContent: 'center', gap: 15 },
      ]}
    >
      <ActivityIndicator color={colors.primary} />
      <Text style={s.muted}>Đang mở sổ tiền…</Text>
    </SafeAreaView>
  );
}
export function ConfirmationDialog(
  title: string,
  message: string,
  danger = false,
): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: 'Hủy', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Xác nhận',
          style: danger ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
export const TransactionRow = memo(function TransactionRow({
  transaction: t,
  index,
}: {
  transaction: Transaction;
  index: TransactionListIndex;
}) {
  const color =
    t.type === 'expense'
      ? colors.expense
      : t.type === 'income'
        ? colors.income
        : colors.muted;
  const tags = transactionCategoryTags(t);
  const category = index.categories.get(t.category_id ?? '');
  const itemCount = index.itemCounts.get(t.id) ?? 0;
  const categoryName = (id: string | null) =>
    index.categoryNames.get(id ?? '') ?? '';
  const name = (id: string | null) => index.accountNames.get(id ?? '') ?? '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${typeNames[t.type]}: ${t.title}`}
      onPress={() =>
        router.push({ pathname: '/transaction/[id]', params: { id: t.id } })
      }
      style={{
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={s.row}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 15,
            backgroundColor:
              t.type === 'expense' ? colors.expenseLight : colors.light,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            color={color}
            name={
              t.type === 'transfer'
                ? 'swap-horizontal-outline'
                : (category?.icon ?? 'receipt-outline')
            }
          />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[s.text, { fontWeight: '600' }]} numberOfLines={1}>
            {t.title}
          </Text>
          <Text style={s.muted} numberOfLines={2}>
            {t.type === 'transfer'
              ? `${name(t.source_account_id)} → ${name(t.destination_account_id)}`
              : `${name(t.source_account_id ?? t.destination_account_id)} · ${tags.length ? tags.map(categoryName).join(' · ') : itemCount ? `${itemCount} ${t.category_split === 1 ? 'danh mục' : 'mục chi'}` : categoryName(category?.id ?? null)}`}
          </Text>
          <TagBadges transaction={t} tags={index.tags} />
        </View>
        <View style={{ alignItems: 'flex-end', maxWidth: '46%' }}>
          <Amount
            value={t.type === 'expense' ? -t.amount : t.amount}
            style={{ color, fontSize: 14 }}
          />
          {t.exclude_from_balance === 1 && (
            <Text style={{ fontSize: 11, color: colors.primary }}>
              Không tính số dư
            </Text>
          )}
          <Text style={{ fontSize: 11, color: colors.muted }}>
            {t.type === 'transfer'
              ? 'Nội bộ'
              : new Date(t.occurred_at).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

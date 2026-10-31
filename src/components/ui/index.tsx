import { transactionCategoryTags } from '../../services/categories/tags';
import { categoryPath } from '../../services/categories/hierarchy';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { colors } from '../../theme';
import { Dropdown } from './Dropdown';
import { usePreferences } from '../../stores/preferences';
import { formatVnd, typeNames } from '../../utils/format';
import type {
  Account,
  Category,
  Ledger,
  Transaction,
} from '../../types/finance';

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
    padding: 20,
    gap: 18,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.8,
  },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text },
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
    color: 'white',
    textAlign: 'center',
  },
  secondary: { backgroundColor: colors.light },
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
  pill: {
    minHeight: 42,
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
});
export function AppHeader({
  title,
  subtitle,
  back = false,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          hitSlop={8}
          style={{ alignSelf: 'flex-start', paddingVertical: 8 }}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/')
          }
        >
          <View style={s.row}>
            <Icon name="arrow-back-outline" />
            <Text style={s.text}>Quay lại</Text>
          </View>
        </Pressable>
      )}
      <Text accessibilityRole="header" style={s.title}>
        {title}
      </Text>
      {subtitle && <Text style={s.muted}>{subtitle}</Text>}
    </View>
  );
}
export function ScreenContainer({
  title,
  subtitle,
  back,
  children,
  scroll = true,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={s.content}
          >
            <AppHeader title={title} subtitle={subtitle} back={back} />
            {children}
          </ScrollView>
        ) : (
          <View style={[s.content, { flex: 1, paddingBottom: 0 }]}>
            <AppHeader title={title} subtitle={subtitle} back={back} />
            {children}
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
export function PrimaryButton({
  label,
  onPress,
  disabled,
  icon,
  danger,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        danger && { backgroundColor: colors.expense },
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      {icon && <Icon name={icon} color="white" />}
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
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
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        s.secondary,
        { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
    >
      {icon && (
        <Icon name={icon} color={danger ? colors.expense : colors.primary} />
      )}
      <Text
        style={[
          s.buttonText,
          { color: danger ? colors.expense : colors.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
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
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
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
      <Text style={s.muted}>
        {/^\d+$/.test(value) && Number.isSafeInteger(Number(value))
          ? formatVnd(Number(value))
          : 'Nhập số nguyên, không dùng dấu phân cách'}
      </Text>
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
        <Pressable
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
        </Pressable>
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
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
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
    <View style={{ gap: 6 }}>
      <Text style={s.label}>Danh mục</Text>
      {variant === 'dropdown' ? (
        <Dropdown
          label="Danh mục"
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
export function TransactionRow({
  transaction: t,
  ledger,
}: {
  transaction: Transaction;
  ledger: Ledger;
}) {
  const color =
    t.type === 'expense'
      ? colors.expense
      : t.type === 'income'
        ? colors.income
        : colors.muted;
  const tags = transactionCategoryTags(t);
  const category = ledger.categories.find((c) => c.id === t.category_id);
  const items = ledger.items.filter((i) => i.transaction_id === t.id);
  const name = (id: string | null) =>
    ledger.accounts.find((a) => a.id === id)?.name ?? '';
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
              : `${name(t.source_account_id ?? t.destination_account_id)} · ${tags.length ? tags.map((id) => categoryPath(ledger.categories, id)).join(' · ') : items.length ? `${items.length} ${t.category_split === 1 ? 'danh mục' : 'mục chi'}` : categoryPath(ledger.categories, category?.id ?? null)}`}
          </Text>
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
}

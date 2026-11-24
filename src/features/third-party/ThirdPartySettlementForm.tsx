import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import {
  AccountPicker,
  AmountInput,
  AppCard,
  Choices,
  ConfirmationDialog,
  Field,
  ScreenContainer,
  SecondaryButton,
  s,
} from '../../components/ui';
import { HeroCard, MoneyRow } from '../../components/ui/primitives';
import { FormActions } from '../../components/ui/FormActions';
import { useFinance, showError } from '../../hooks/finance';
import {
  accountBalances,
  parseAmount,
  safeAdd,
} from '../../services/accounting/ledger';
import {
  previewThirdPartySettlement,
  thirdPartyBalances,
} from '../../services/third-party';
import { transactionTagIds } from '../../services/tags';
import type { ThirdPartyCase } from '../../types/third-party';
import { colors } from '../../theme';
import { PurchaseDateField } from '../purchases/PurchaseDateField';
import { TagPicker } from '../tags/TagPicker';
import { TransactionCategoryPicker } from '../categories/TransactionCategoryPicker';

export function ThirdPartySettlementForm({ item }: { item: ThirdPartyCase }) {
  const { data, mutate, busy } = useFinance();
  const balance = useMemo(
    () => thirdPartyBalances(data).get(item.id)!,
    [data, item.id],
  );
  const [revision] = useState(item.revision);
  const [id] = useState(randomUUID);
  const [method, setMethod] = useState<'cash' | 'personal' | 'split'>('cash');
  const [cash, setCash] = useState(String(Math.abs(balance.difference)));
  const [personal, setPersonal] = useState('0');
  const [account, setAccount] = useState(
    data.accounts.find((a) => !a.is_archived)?.id ?? '',
  );
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState(() => transactionTagIds(item));
  const [note, setNote] = useState('');
  const [occurred, setOccurred] = useState(() => new Date());
  const [dateValid, setDateValid] = useState(true);
  const [confirmedCash, setConfirmedCash] = useState(false);
  const canComplete =
    item.status === 'fulfilled' || item.status === 'cancelled';
  const [complete, setComplete] = useState(
    canComplete && balance.difference === 0,
  );
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const holding = balance.difference > 0;
  let error = '';
  let preview: ReturnType<typeof previewThirdPartySettlement> | null = null;
  let cashValue = 0,
    personalValue = 0;
  try {
    cashValue = parseAmount(cash || '0', true);
    personalValue = parseAmount(personal || '0', true);
    preview = previewThirdPartySettlement(
      balance.difference,
      cashValue,
      personalValue,
    );
  } catch (reason) {
    error = reason instanceof Error ? reason.message : 'Số tiền không hợp lệ.';
  }
  const stale = item.revision !== revision;
  const accounts = data.accounts.filter((a) => !a.is_archived);
  const walletBalances = useMemo(() => accountBalances(data), [data]);
  let projectedBalance: number | null = null;
  if (preview && cashValue && account) {
    try {
      projectedBalance = safeAdd(
        walletBalances[account] ?? 0,
        preview.balanceImpact,
      );
    } catch (reason) {
      error =
        reason instanceof Error
          ? reason.message
          : 'Số dư vượt giới hạn an toàn.';
    }
  }
  const save = async () => {
    if (pending.current || busy || !preview || stale) return;
    pending.current = true;
    setSaving(true);
    try {
      if (
        !(await ConfirmationDialog(
          'Xác nhận quyết toán?',
          'Chỉ xác nhận phần tiền đã thực nhận / thực trả và phần thu chi cá nhân bạn đồng ý ghi nhận. Kết quả áp dụng theo bảng xem trước.',
        ))
      )
        return;
      const saved = await mutate((repo) =>
        repo.settleThirdPartyCase(
          {
            id,
            case_id: item.id,
            cash_amount: cashValue,
            personal_amount: personalValue,
            account_id: cashValue ? account : null,
            category_id: personalValue ? category || null : null,
            tag_ids_json: personalValue ? JSON.stringify(tags) : '[]',
            note,
            occurred_at: occurred.toISOString(),
            complete_case: complete,
          },
          revision,
        ),
      );
      if (saved) {
        Alert.alert(
          'Đã quyết toán',
          complete
            ? 'Hồ sơ đã hoàn tất.'
            : 'Đã cập nhật số tiền còn cần xử lý.',
        );
        router.back();
      }
    } catch (reason) {
      showError(reason);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  const toggle = (
    label: string,
    value: boolean,
    onChange: (value: boolean) => void,
  ) => (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled: busy || saving }}
      disabled={busy || saving}
      onPress={() => onChange(!value)}
      style={[s.row, { minHeight: 48, paddingVertical: 10 }]}
    >
      <Text style={[s.text, { color: colors.primary }]}>
        {value ? '☑' : '☐'}
      </Text>
      <Text style={[s.text, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
  return (
    <ScreenContainer
      title="Quyết toán thu chi hộ"
      subtitle={`${item.title} · ${item.person}`}
      back
      backDisabled={busy || saving}
      footer={
        <FormActions
          saveLabel={complete ? 'Quyết toán & hoàn tất' : 'Xác nhận quyết toán'}
          busy={busy || saving}
          saveDisabled={
            stale ||
            item.status === 'completed' ||
            !dateValid ||
            !!error ||
            !preview ||
            (!!cashValue &&
              (!account ||
                !confirmedCash ||
                projectedBalance === null ||
                projectedBalance < 0)) ||
            (!!personalValue && !category) ||
            (!cashValue && !personalValue && !complete) ||
            (complete && preview?.difference !== 0)
          }
          onCancel={() => router.back()}
          onSave={() => void save()}
        />
      }
    >
      <HeroCard
        label={
          balance.difference === 0
            ? 'Đã cân bằng tài chính'
            : holding
              ? 'Tiền đang giữ hộ'
              : 'Tiền cần thu lại'
        }
        value={Math.abs(balance.difference)}
        subtitle={item.person}
      />
      <AppCard>
        {stale && (
          <Text style={s.text}>
            Hồ sơ vừa thay đổi. Quay lại và mở quyết toán để xem số tiền mới
            nhất.
          </Text>
        )}
        {!!balance.difference && (
          <Choices
            value={method}
            onChange={(value) => {
              setMethod(value);
              setConfirmedCash(false);
              setComplete(false);
              setCash(
                value === 'cash' ? String(Math.abs(balance.difference)) : '0',
              );
              setPersonal(
                value === 'personal'
                  ? String(Math.abs(balance.difference))
                  : '0',
              );
            }}
            options={[
              { value: 'cash', label: holding ? 'Trả lại' : 'Thu lại' },
              { value: 'personal', label: holding ? 'Giữ lại' : 'Tự chịu' },
              { value: 'split', label: 'Kết hợp / một phần' },
            ]}
          />
        )}
        <SecondaryButton label="Quyết toán sau" onPress={() => router.back()} />
      </AppCard>
      {!!balance.difference && (
        <AppCard>
          {(method === 'cash' || method === 'split') && (
            <AmountInput
              prominent
              label={
                holding ? 'Tiền thực trả lại (VND)' : 'Tiền thực nhận lại (VND)'
              }
              value={cash}
              onChangeText={(value) => {
                setCash(value);
                setConfirmedCash(false);
                setComplete(false);
              }}
            />
          )}
          {(method === 'personal' || method === 'split') && (
            <AmountInput
              prominent
              label={
                holding
                  ? 'Giữ lại làm thu nhập (VND)'
                  : 'Tự chịu làm chi tiêu (VND)'
              }
              value={personal}
              onChangeText={(value) => {
                setPersonal(value);
                setComplete(false);
              }}
            />
          )}
          {!!cashValue && (
            <>
              <AccountPicker
                variant="dropdown"
                accounts={accounts}
                value={account}
                onChange={setAccount}
              />
              {toggle(
                holding
                  ? 'Tôi đã thực trả khoản tiền này'
                  : 'Tôi đã thực nhận khoản tiền này',
                confirmedCash,
                setConfirmedCash,
              )}
            </>
          )}
          {!!personalValue && (
            <>
              <TransactionCategoryPicker
                type={holding ? 'income' : 'expense'}
                value={category}
                onChange={setCategory}
              />
              <TagPicker value={tags} onChange={setTags} />
              <Text style={s.muted}>
                Phần này chỉ vào báo cáo cá nhân, không cộng / trừ số dư thêm
                lần nữa.
              </Text>
            </>
          )}
        </AppCard>
      )}
      <AppCard>
        <PurchaseDateField
          label="Ngày quyết toán"
          value={occurred}
          onChange={(date) => {
            if (date) setOccurred(date);
          }}
          onValidityChange={setDateValid}
          disabled={busy || saving}
        />
        <Field
          label="Ghi chú"
          value={note}
          onChangeText={setNote}
          maxLength={4000}
          multiline
          editable={!busy && !saving}
        />
        {canComplete &&
          preview?.difference === 0 &&
          toggle(
            'Công việc đã kết thúc, hoàn tất hồ sơ sau quyết toán',
            complete,
            setComplete,
          )}
        {!canComplete && (
          <Text style={s.muted}>
            Để hoàn tất hồ sơ, quay lại chi tiết và đánh dấu công việc đã thực
            hiện. Cân bằng tiền không tự động hoàn tất công việc.
          </Text>
        )}
      </AppCard>
      <AppCard>
        <Text style={s.heading}>Xem trước kết quả</Text>
        {!!error && (
          <Text style={[s.text, { color: colors.danger }]}>{error}</Text>
        )}
        {preview && (
          <>
            {[
              ['Chênh lệch hiện tại', balance.difference],
              ['Tiền thực tế vào / ra ví', preview.balanceImpact],
              ['Thu nhập cá nhân', preview.income],
              ['Chi tiêu cá nhân', preview.expense],
              ['Chênh lệch còn lại', preview.difference],
            ].map(([label, value]) => (
              <MoneyRow
                key={String(label)}
                label={String(label)}
                value={Number(value)}
              />
            ))}
            {!!cashValue && (
              <>
                <Text style={s.muted}>
                  Tài khoản:{' '}
                  {data.accounts.find((a) => a.id === account)?.name ??
                    'Chưa chọn'}
                </Text>
                {projectedBalance !== null && (
                  <MoneyRow label="Số dư ví dự kiến" value={projectedBalance} />
                )}
              </>
            )}
            <Text style={s.text}>
              {complete
                ? 'Sau quyết toán: Hoàn tất'
                : preview.difference
                  ? 'Sau quyết toán: Tiếp tục theo dõi công nợ còn lại'
                  : 'Sau quyết toán: Đã cân bằng, công việc giữ nguyên trạng thái'}
            </Text>
          </>
        )}
      </AppCard>
    </ScreenContainer>
  );
}

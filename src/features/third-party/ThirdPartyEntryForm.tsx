import { useRef, useState } from 'react';
import { Alert, Text } from 'react-native';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import {
  AccountPicker,
  AmountInput,
  AppCard,
  ConfirmationDialog,
  Field,
  ScreenContainer,
  s,
} from '../../components/ui';
import { Dropdown } from '../../components/ui/Dropdown';
import { FormActions } from '../../components/ui/FormActions';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { useFinance, showError } from '../../hooks/finance';
import { parseAmount } from '../../services/accounting/money';
import {
  isThirdPartyPersonal,
  thirdPartyEntryLabels,
} from '../../services/third-party';
import { transactionTagIds } from '../../services/tags';
import type {
  ThirdPartyCase,
  ThirdPartyEntry,
  ThirdPartyEntryKind,
} from '../../types/third-party';
import { PurchaseDateField } from '../purchases/PurchaseDateField';
import { TagPicker } from '../tags/TagPicker';
import { TransactionCategoryPicker } from '../categories/TransactionCategoryPicker';

export function ThirdPartyEntryForm({
  item,
  entry,
  initialKind,
}: {
  item: ThirdPartyCase;
  entry?: ThirdPartyEntry;
  initialKind?: ThirdPartyEntryKind;
}) {
  const { data, mutate, busy } = useFinance();
  const [id] = useState(() => entry?.id ?? randomUUID());
  const [revision] = useState(item.revision);
  const [kind, setKind] = useState<ThirdPartyEntryKind>(
    entry?.kind ?? initialKind ?? 'receive',
  );
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '');
  const [account, setAccount] = useState(
    entry?.account_id ?? data.accounts.find((a) => !a.is_archived)?.id ?? '',
  );
  const [category, setCategory] = useState(entry?.category_id ?? '');
  const [related, setRelated] = useState(entry?.related_entry_id ?? '');
  const [note, setNote] = useState(entry?.note ?? '');
  const [tags, setTags] = useState(() => transactionTagIds(entry ?? item));
  const [date, setDate] = useState(
    () => new Date(entry?.occurred_at ?? Date.now()),
  );
  const [dateValid, setDateValid] = useState(true);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const personal = isThirdPartyPersonal(kind);
  const locked = item.status === 'completed' || !!entry?.settlement_id;
  const accountOptions = data.accounts.filter(
    (a) => !a.is_archived || a.id === entry?.account_id,
  );
  const payments = (data.thirdPartyEntries ?? []).filter(
    (e) => e.case_id === item.id && e.kind === 'payment',
  );
  const save = async () => {
    if (pending.current || busy || locked) return;
    pending.current = true;
    setSaving(true);
    try {
      const value = parseAmount(amount);
      const now = new Date().toISOString();
      if (
        !(await ConfirmationDialog(
          entry ? 'Sửa bút toán đã ghi?' : 'Ghi nhận bút toán?',
          personal
            ? 'Khoản này chỉ ghi nhận thu chi cá nhân, không cộng trừ số dư.'
            : 'Chỉ xác nhận khi tiền đã thực nhận hoặc thực trả. Số dư tài khoản sẽ được tính lại.',
        ))
      )
        return;
      const saved = await mutate((repo) =>
        repo.saveThirdPartyEntry(
          {
            id,
            case_id: item.id,
            kind,
            amount: value,
            account_id: personal ? null : account,
            category_id: personal ? category || null : null,
            related_entry_id:
              kind === 'payment_refund' ? related || null : null,
            settlement_id: null,
            tag_ids_json: JSON.stringify(tags),
            note,
            occurred_at: date.toISOString(),
            created_at: entry?.created_at ?? now,
            updated_at: now,
          },
          !!entry,
          revision,
        ),
      );
      if (saved) {
        Alert.alert('Đã ghi nhận', thirdPartyEntryLabels[kind]);
        router.back();
      }
    } catch (error) {
      showError(error);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  return (
    <ScreenContainer
      title={entry ? 'Sửa bút toán thu chi hộ' : 'Thêm bút toán thu chi hộ'}
      subtitle={`${item.title} · ${item.person}`}
      back
      backDisabled={busy || saving}
      rightAction={
        entry && !locked ? (
          <ActionMenu
            label="Thao tác bút toán thu chi hộ"
            disabled={busy || saving}
            actions={[
              {
                label: 'Xóa bút toán ghi nhầm',
                icon: 'trash-outline',
                danger: true,
                onPress: () => {
                  void (async () => {
                    if (
                      await ConfirmationDialog(
                        'Xóa bút toán ghi nhầm?',
                        'Số dư, công nợ và báo cáo sẽ được tính lại. Chỉ xóa khi nhập sai; nếu thực tế có hoàn tiền, hãy ghi bút toán hoàn tiền.',
                      )
                    )
                      if (
                        await mutate((repo) =>
                          repo.deleteThirdPartyEntry(entry.id, revision),
                        )
                      )
                        router.back();
                  })();
                },
              },
            ]}
          />
        ) : undefined
      }
      footer={
        <FormActions
          busy={busy || saving}
          saveDisabled={
            locked ||
            !dateValid ||
            !amount.trim() ||
            (personal ? !category : !account) ||
            (kind === 'payment_refund' && !related)
          }
          onCancel={() => router.back()}
          onSave={() => void save()}
        />
      }
    >
      {locked && (
        <Text style={s.text}>
          Hãy mở lại hồ sơ hoặc hoàn tác cả lần quyết toán trong lịch sử trước
          khi sửa.
        </Text>
      )}
      <AppCard>
        <Dropdown
          label="Loại bút toán"
          placeholder="Chọn nghiệp vụ"
          value={kind}
          onChange={(next) => {
            setKind(next as ThirdPartyEntryKind);
            setCategory('');
          }}
          options={(
            Object.keys(thirdPartyEntryLabels) as ThirdPartyEntryKind[]
          ).map((value) => ({ value, label: thirdPartyEntryLabels[value] }))}
        />
        <AmountInput
          prominent
          label="Số tiền (VND)"
          value={amount}
          onChangeText={setAmount}
        />
        <Text style={s.muted}>
          {personal
            ? 'Không đổi số dư. Khoản giữ lại / tự chịu được ghi nhận vào báo cáo cá nhân theo ngày bút toán.'
            : 'Tăng / giảm số dư ví thực tế. Không tính vào thu nhập hoặc chi tiêu cá nhân.'}
        </Text>
        {personal ? (
          <TransactionCategoryPicker
            type={kind === 'settlement_income' ? 'income' : 'expense'}
            value={category}
            onChange={setCategory}
          />
        ) : (
          <AccountPicker
            variant="dropdown"
            accounts={accountOptions}
            value={account}
            onChange={setAccount}
          />
        )}
        {kind === 'payment_refund' && (
          <Dropdown
            label="Khoản thanh toán gốc"
            value={related}
            onChange={setRelated}
            options={payments.map((p) => ({
              value: p.id,
              label: `#${p.sequence} · ${new Date(p.occurred_at).toLocaleString('vi-VN')} · ${p.note || 'Thanh toán hộ'}`,
            }))}
            placeholder="Chọn khoản được nhà bán hoàn"
          />
        )}
      </AppCard>
      <AppCard>
        <PurchaseDateField
          label="Ngày ghi nhận"
          value={date}
          onChange={(next) => {
            if (next) setDate(next);
          }}
          onValidityChange={setDateValid}
          disabled={busy || saving}
        />
        <TagPicker value={tags} onChange={setTags} />
        <Field
          label="Ghi chú"
          value={note}
          onChangeText={setNote}
          maxLength={4000}
          multiline
          editable={!busy && !saving}
        />
      </AppCard>
    </ScreenContainer>
  );
}

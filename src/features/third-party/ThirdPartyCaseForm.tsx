import { useRef, useState } from 'react';
import { Alert, Text } from 'react-native';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import {
  AmountInput,
  AppCard,
  Field,
  ScreenContainer,
  s,
} from '../../components/ui';
import { Disclosure } from '../../components/ui/primitives';
import { FormActions } from '../../components/ui/FormActions';
import { useFinance, showError } from '../../hooks/finance';
import { parseAmount } from '../../services/accounting/money';
import { transactionTagIds } from '../../services/tags';
import type { ThirdPartyCase } from '../../types/third-party';
import { PurchaseDateField } from '../purchases/PurchaseDateField';
import { TagPicker } from '../tags/TagPicker';

export function ThirdPartyCaseForm({ item }: { item?: ThirdPartyCase }) {
  const { mutate, busy } = useFinance();
  const [id] = useState(() => item?.id ?? randomUUID());
  const [revision] = useState(item?.revision ?? 0);
  const [title, setTitle] = useState(item?.title ?? '');
  const [person, setPerson] = useState(item?.person ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [expected, setExpected] = useState(
    item?.expected_amount == null ? '' : String(item.expected_amount),
  );
  const [note, setNote] = useState(item?.note ?? '');
  const [tags, setTags] = useState(() => (item ? transactionTagIds(item) : []));
  const [started, setStarted] = useState(
    () => new Date(item?.started_at ?? Date.now()),
  );
  const [due, setDue] = useState<Date | null>(
    item?.due_at ? new Date(item.due_at) : null,
  );
  const [startValid, setStartValid] = useState(true),
    [dueValid, setDueValid] = useState(true);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const save = async () => {
    if (pending.current || busy) return;
    pending.current = true;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const saved = await mutate((repo) =>
        repo.saveThirdPartyCase(
          {
            id,
            title,
            person,
            description,
            expected_amount: expected.trim()
              ? parseAmount(expected, true)
              : null,
            started_at: started.toISOString(),
            due_at: due?.toISOString() ?? null,
            note,
            tag_ids_json: JSON.stringify(tags),
            status: item?.status ?? 'pending',
            completed_at: item?.completed_at ?? null,
            created_at: item?.created_at ?? now,
            updated_at: now,
            revision,
          },
          !!item,
        ),
      );
      if (saved) {
        Alert.alert('Đã lưu', 'Hồ sơ thu chi hộ đã được cập nhật.');
        if (item) router.back();
        else router.replace({ pathname: '/third-party/[id]', params: { id } });
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
      title={item ? 'Sửa hồ sơ thu chi hộ' : 'Tạo khoản thu chi hộ'}
      back
      backDisabled={busy || saving}
      subtitle="Tạo hồ sơ trước, ghi dòng tiền khi thực tế phát sinh."
      footer={
        <FormActions
          busy={busy || saving}
          saveDisabled={
            !title.trim() || !person.trim() || !startValid || !dueValid
          }
          onCancel={() => router.back()}
          onSave={() => void save()}
        />
      }
    >
      <AppCard>
        <Field
          label="Tên khoản thu chi hộ"
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          editable={!busy && !saving}
          placeholder="Ví dụ: Mua vé hộ Minh"
        />
        <Field
          label="Người liên quan"
          value={person}
          onChangeText={setPerson}
          maxLength={100}
          editable={!busy && !saving}
        />
        <Field
          label="Mô tả (không bắt buộc)"
          value={description}
          onChangeText={setDescription}
          maxLength={4000}
          multiline
          editable={!busy && !saving}
        />
        <AmountInput
          label="Số tiền dự kiến (không bắt buộc)"
          value={expected}
          onChangeText={setExpected}
        />
        <Text style={s.muted}>
          Tiền dự kiến chỉ để tham khảo, không đổi số dư hay báo cáo.
        </Text>
      </AppCard>
      <AppCard>
        <Disclosure title="Ngày, tag và ghi chú" defaultOpen={!!item}>
          <PurchaseDateField
            label="Ngày bắt đầu"
            value={started}
            onChange={(date) => {
              if (date) setStarted(date);
            }}
            onValidityChange={setStartValid}
            disabled={busy || saving}
          />
          <PurchaseDateField
            label="Hạn quyết toán"
            value={due}
            onChange={setDue}
            onValidityChange={setDueValid}
            optional
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
        </Disclosure>
      </AppCard>
    </ScreenContainer>
  );
}

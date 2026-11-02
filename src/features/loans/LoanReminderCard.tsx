import { useState } from 'react';
import { Alert, Linking, Text } from 'react-native';
import type { Loan } from '../../types/finance';
import {
  AppCard,
  PrimaryButton,
  SecondaryButton,
  s,
} from '../../components/ui';
import { useFinance } from '../../hooks/finance';
import { requestLoanReminderPermission } from '../../services/loan-reminders/notifications';
import { LoanReminderFields } from './LoanReminderFields';

export function LoanReminderCard({ loan }: { loan: Loan }) {
  const { mutate, busy, reminderWarning } = useFinance();
  const [day, setDay] = useState(
    loan.payment_day ? String(loan.payment_day) : '',
  );
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving || busy) return;
    setSaving(true);
    try {
      if (day) {
        const warning = await requestLoanReminderPermission();
        if (warning) Alert.alert('Nhắc lịch trên máy', warning);
      }
      if (
        await mutate((repo) =>
          repo.setLoanPaymentDay(loan.id, day ? Number(day) : null),
        )
      )
        Alert.alert(
          'Đã lưu',
          day
            ? `Ngày nhắc: ${day} hằng tháng, lúc 09:00.`
            : 'Đã tắt nhắc hằng tháng.',
        );
    } finally {
      setSaving(false);
    }
  };
  return (
    <AppCard>
      <Text style={s.heading}>Lịch nhắc hằng tháng</Text>
      <Text style={s.muted}>
        {loan.payment_day
          ? `Đã lưu: ngày ${loan.payment_day} hằng tháng · 09:00`
          : 'Chưa bật nhắc hằng tháng.'}
      </Text>
      <LoanReminderFields
        value={day}
        onChange={setDay}
        lending={loan.direction === 'lend'}
      />
      {!!reminderWarning && (
        <>
          <Text style={s.text}>{reminderWarning}</Text>
          <SecondaryButton
            label="Mở cài đặt thông báo"
            disabled={saving || busy}
            onPress={() => {
              void Linking.openSettings().catch(() =>
                Alert.alert(
                  'Cài đặt',
                  'Hãy mở Cài đặt của máy và chọn Moni để bật thông báo.',
                ),
              );
            }}
          />
        </>
      )}
      <PrimaryButton
        label="Lưu lịch nhắc"
        disabled={saving || busy}
        onPress={() => void save()}
      />
    </AppCard>
  );
}

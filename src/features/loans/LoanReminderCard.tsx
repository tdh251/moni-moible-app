import { useRef, useState } from 'react';
import { Alert, Linking, Text } from 'react-native';
import type { Loan } from '../../types/finance';
import { AppCard, SecondaryButton, s } from '../../components/ui';
import { showError, useFinance } from '../../hooks/finance';
import { requestLoanReminderPermission } from '../../services/loan-reminders/notifications';
import { LoanReminderFields } from './LoanReminderFields';

export function LoanReminderCard({ loan }: { loan: Loan }) {
  const { mutate, busy, reminderWarning } = useFinance();
  const day = loan.payment_day ? String(loan.payment_day) : '';
  const timeMinutes = loan.payment_time_minutes ?? 540;
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const save = async (nextDay: string, nextTime: number) => {
    if (savingRef.current || busy) return;
    if (nextDay === day && nextTime === timeMinutes) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const warning =
        nextDay && !day ? await requestLoanReminderPermission() : null;
      const saved = await mutate((repo) =>
        repo.setLoanPaymentDay(
          loan.id,
          nextDay ? Number(nextDay) : null,
          nextTime,
        ),
      );
      if (saved && warning) Alert.alert('Nhắc lịch trên máy', warning);
    } catch (error) {
      showError(error);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <AppCard>
      <Text style={s.heading}>Lịch nhắc hằng tháng</Text>
      <LoanReminderFields
        value={day}
        onChange={(value) => void save(value, timeMinutes)}
        lending={loan.direction === 'lend'}
        timeMinutes={timeMinutes}
        onTimeChange={(value) => void save(day, value)}
        disabled={saving || busy}
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
    </AppCard>
  );
}

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { Ledger } from '../types/finance';
import { syncLoanReminders } from '../services/loan-reminders/notifications';

export function useLoanReminders(data: Ledger, ready: boolean) {
  const [warning, setWarning] = useState<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const sync = () => {
      void syncLoanReminders(data).then((value) => {
        if (active) setWarning(value);
      });
    };
    sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    // Refill the pending queue if the app stays open across a reminder day.
    const timer = setInterval(sync, 60 * 60 * 1000);
    return () => {
      active = false;
      subscription.remove();
      clearInterval(timer);
    };
  }, [data, ready]);
  return warning;
}

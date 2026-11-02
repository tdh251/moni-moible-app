import { Platform } from 'react-native';
import type { Ledger } from '../../types/finance';
import { planLoanReminders } from './plan';

const CHANNEL = 'loan-reminders';
const PREFIX = 'loan-reminder:';
const permissionWarning =
  'Thông báo chưa được cho phép. Hãy bật thông báo cho Moni trong Cài đặt của máy.';
let queue: Promise<unknown> = Promise.resolve();
let handlerInstalled = false;

async function notifications() {
  const api = await import('expo-notifications');
  if (!handlerInstalled) {
    api.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerInstalled = true;
  }
  if (Platform.OS === 'android')
    await api.setNotificationChannelAsync(CHANNEL, {
      name: 'Nhắc trả nợ / thu hồi',
      importance: api.AndroidImportance.HIGH,
      sound: 'default',
    });
  return api;
}

function allowed(
  status: Awaited<
    ReturnType<(typeof import('expo-notifications'))['getPermissionsAsync']>
  >,
  api: typeof import('expo-notifications'),
) {
  // iOS can authorize quiet/provisional notifications separately from root status.
  return Platform.OS === 'ios'
    ? [
        api.IosAuthorizationStatus.AUTHORIZED,
        api.IosAuthorizationStatus.PROVISIONAL,
        api.IosAuthorizationStatus.EPHEMERAL,
      ].includes(
        status.ios?.status ?? api.IosAuthorizationStatus.NOT_DETERMINED,
      )
    : status.granted;
}

export async function requestLoanReminderPermission(): Promise<string | null> {
  if (Platform.OS === 'web')
    return 'Lịch đã lưu; thông báo trên máy chỉ hỗ trợ ứng dụng Android / iOS.';
  try {
    const api = await notifications();
    let status = await api.getPermissionsAsync();
    if (!allowed(status, api) && status.canAskAgain)
      status = await api.requestPermissionsAsync();
    return allowed(status, api) ? null : permissionWarning;
  } catch {
    return 'Chưa thể bật thông báo. Hãy kiểm tra quyền thông báo và dùng bản cài Moni mới nhất.';
  }
}

async function reconcile(ledger: Ledger): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const api = await notifications();
  const existing = await api.getAllScheduledNotificationsAsync();
  // Leave room under iOS's pending-notification limit, including other app features.
  const otherCount = existing.filter(
    (item) => !item.identifier.startsWith(PREFIX),
  ).length;
  const planned = planLoanReminders(
    ledger,
    new Date(),
    Math.max(0, 60 - otherCount),
  );
  const desired = new Map(planned.map((item) => [item.id, item]));
  const kept = new Set<string>();
  for (const item of existing) {
    if (!item.identifier.startsWith(PREFIX)) continue;
    const next = desired.get(item.identifier);
    if (
      next &&
      item.content.title === next.title &&
      item.content.body === next.body
    )
      kept.add(item.identifier);
    else await api.cancelScheduledNotificationAsync(item.identifier);
  }
  if (!planned.length) return null;
  if (!allowed(await api.getPermissionsAsync(), api)) return permissionWarning;
  for (const item of planned) {
    if (kept.has(item.id)) continue;
    await api.scheduleNotificationAsync({
      identifier: item.id,
      content: {
        title: item.title,
        body: item.body,
        sound: 'default',
        data: { loanId: item.loanId },
      },
      trigger: {
        type: api.SchedulableTriggerInputTypes.DATE,
        date: item.date,
        channelId: CHANNEL,
        delivery: 'bestEffort',
      },
    });
  }
  return null;
}

// Writes, restore/reset and foreground refreshes must not race OS scheduling.
export function syncLoanReminders(ledger: Ledger): Promise<string | null> {
  const work = queue
    .then(() => reconcile(ledger))
    .catch(
      () => 'Chưa thể cập nhật lịch thông báo. Hãy mở lại Moni để thử lại.',
    );
  queue = work;
  return work;
}

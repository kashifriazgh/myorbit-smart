export type MyOrbitNotificationType =
  | 'todo'
  | 'schedule'
  | 'goal'
  | 'finance'
  | 'overdue'
  | 'summary_morning'
  | 'summary_evening'
  | 'general';

export interface MyOrbitNotificationPayload {
  notificationType: MyOrbitNotificationType;
  entityId?: string;
  userId?: string;
  title: string;
  body: string;
  appUrl?: string;
  tag?: string;
  timestamp?: number;
  extra?: Record<string, unknown>;
}

export interface NotificationActionOption {
  action: string;
  title: string;
  icon?: string;
}

export interface ResolvedNotificationOptions {
  title: string;
  body: string;
  icon: string;
  badge: string;
  tag: string;
  appUrl: string;
  vibrate: number[];
  silent: boolean;
  renotify: boolean;
  requireInteraction: boolean;
  actions: NotificationActionOption[];
  data: Record<string, unknown>;
}

/**
 * Resolves standard Web Push / SW notification options based on the notification payload type.
 */
export function buildNotificationOptions(payload: Partial<MyOrbitNotificationPayload>): ResolvedNotificationOptions {
  const type: MyOrbitNotificationType = payload.notificationType || 'general';
  const entityId = payload.entityId || '';
  const title = payload.title || getDefaultTitleForType(type);
  const body = payload.body || 'You have a new update in MyOrbit.';
  
  let defaultUrl = '/';
  let actions: NotificationActionOption[] = [
    { action: 'view', title: '👁 Open' },
    { action: 'dismiss', title: 'Dismiss' },
  ];

  switch (type) {
    case 'todo':
      defaultUrl = entityId ? `/to-do/${entityId}` : '/to-do';
      actions = [
        { action: 'action_done', title: '✓ Done' },
        { action: 'action_snooze', title: '💤 Snooze' },
        { action: 'view', title: 'Open' },
      ];
      break;

    case 'schedule':
      defaultUrl = '/';
      actions = [
        { action: 'action_done', title: '✓ Done' },
        { action: 'action_snooze', title: '⏰ Snooze' },
        { action: 'view', title: 'Open' },
      ];
      break;

    case 'goal':
      defaultUrl = entityId ? `/goals/${entityId}` : '/goals';
      actions = [
        { action: 'action_log', title: '✓ Log' },
        { action: 'action_snooze', title: '💤 Later' },
        { action: 'view', title: 'Open' },
      ];
      break;

    case 'overdue':
      defaultUrl = '/to-do';
      actions = [
        { action: 'action_done', title: '✓ Complete' },
        { action: 'action_reschedule', title: '📅 Reschedule' },
        { action: 'view', title: 'Open' },
      ];
      break;

    case 'finance':
      defaultUrl = '/finance';
      actions = [
        { action: 'view', title: '📊 View' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
      break;

    case 'summary_morning':
    case 'summary_evening':
      defaultUrl = '/';
      actions = [
        { action: 'view', title: '👁 View Summary' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
      break;

    case 'general':
    default:
      defaultUrl = payload.appUrl || '/';
      actions = [
        { action: 'view', title: '👁 Open' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
      break;
  }

  const appUrl = payload.appUrl || defaultUrl;
  const tagKey = payload.tag || (entityId ? `myorbit-${type}-${entityId}` : `myorbit-${type}-${Date.now()}`);

  return {
    title,
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: tagKey,
    appUrl,
    vibrate: [200, 100, 200, 100, 200], // Distinct vibration pattern for Android PWAs
    silent: false, // Ensures Android notification sound plays
    renotify: true, // Play sound and vibrate even if tag is updated
    requireInteraction: true,
    actions,
    data: {
      notificationType: type,
      entityId,
      appUrl,
      userId: payload.userId || '',
      tag: tagKey,
      timestamp: payload.timestamp || Date.now(),
      ...(payload.extra || {}),
    },
  };
}

function getDefaultTitleForType(type: MyOrbitNotificationType): string {
  switch (type) {
    case 'todo':
      return 'Task Reminder 📝';
    case 'schedule':
      return 'Schedule Alert 📅';
    case 'goal':
      return 'Goal Check-in 🎯';
    case 'finance':
      return 'Finance Alert 💰';
    case 'overdue':
      return 'Overdue Tasks ⚠️';
    case 'summary_morning':
      return 'Good Morning ☀️ — Today\'s Focus';
    case 'summary_evening':
      return 'Evening Recap 🌙 — Day Review';
    case 'general':
    default:
      return 'MyOrbit Notification 🔔';
  }
}

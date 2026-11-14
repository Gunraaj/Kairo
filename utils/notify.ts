export const notificationsSupported = (): boolean => typeof window !== 'undefined' && 'Notification' in window;

export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  notificationsSupported() ? Notification.permission : 'unsupported';

/** Must be called from a click handler. */
export const requestNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
};

/**
 * Shows a notification through the service worker when one is registered (required on
 * Android and for installed apps), otherwise through the page. Never throws.
 */
export const showSessionNotification = async (title: string, body: string): Promise<void> => {
  if (notificationPermission() !== 'granted') return;
  try {
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration) {
      await registration.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'kairo-session', renotify: true } as NotificationOptions);
      return;
    }
    new Notification(title, { body, icon: '/icon-192.png' });
  } catch {
    // Notifications are a convenience; ignore failures.
  }
};

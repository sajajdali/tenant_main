import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { subscribeUserNotificationInboxUpdates } from "@/lib/realtime";

export function useUnreadNotificationsCount(enabled: boolean, tenantUserId?: string | null) {
  const [count, setCount] = useState(0);

  const reload = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }

    const res = await api.notifications.unreadCount();
    if (res.success) {
      setCount(Math.max(0, Number(res.data.count || 0)));
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [enabled, reload]);

  useEffect(() => {
    const handler = () => {
      void reload();
    };

    window.addEventListener("notifications:updated", handler);
    return () => {
      window.removeEventListener("notifications:updated", handler);
    };
  }, [reload]);

  useEffect(() => {
    if (!enabled || !tenantUserId) {
      return;
    }

    return subscribeUserNotificationInboxUpdates(tenantUserId, ({ unreadCount }) => {
      setCount(Math.max(0, Number(unreadCount || 0)));
    });
  }, [enabled, tenantUserId]);

  return { count, reload };
}

export function emitNotificationsUpdated() {
  window.dispatchEvent(new CustomEvent("notifications:updated"));
}

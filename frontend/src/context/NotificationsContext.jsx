import { createContext, useEffect, useMemo, useState } from "react";
import { useSocket } from "../hooks/useSocket";
import { useUiPreferences } from "../hooks/useUiPreferences";

export const NotificationsContext = createContext(null);

const MAX_NOTIFICATIONS = 50;

export function NotificationsProvider({ children }) {
  const { socket } = useSocket();
  const { t } = useUiPreferences();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const addNotification = (notification) => {
      setNotifications((currentNotifications) => [
        notification,
        ...currentNotifications.filter((item) => item.id !== notification.id),
      ].slice(0, MAX_NOTIFICATIONS));
    };

    const handleAlert = (payload = {}) => {
      addNotification({
        id: `alert:${payload.id || Date.now()}`,
        type: "alert",
        message: payload.message || t("notifications.alertMessage"),
        patientId: payload.patientId,
        createdAt: payload.createdAt || new Date().toISOString(),
        read: false,
      });
    };

    const handleReading = (payload = {}) => {
      addNotification({
        id: `reading:${payload.id || payload.timestamp || Date.now()}`,
        type: "reading",
        message: t("notifications.readingMessage", {
          spo2: payload.spo2 ?? t("common.notAvailable"),
          bpm: payload.bpm ?? t("common.notAvailable"),
        }),
        patientId: payload.patientId,
        createdAt: payload.timestamp || new Date().toISOString(),
        read: false,
      });
    };

    socket.on("alert:new", handleAlert);
    socket.on("reading:new", handleReading);

    return () => {
      socket.off("alert:new", handleAlert);
      socket.off("reading:new", handleReading);
    };
  }, [socket, t]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const markRead = (id) => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  const markAllRead = () => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({ ...notification, read: true }))
    );
  };

  const dismissAll = () => {
    setNotifications([]);
  };

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        markAllRead,
        markRead,
        dismissAll,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

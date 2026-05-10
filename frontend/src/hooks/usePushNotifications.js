import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "./useAuth";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const getVapidPublicKey = () =>
  import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() || "";

const createPushError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const isSecurePushContext = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.isSecureContext || LOCAL_HOSTS.has(window.location.hostname);
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
};

const getRolePushPath = (role) =>
  role === "doctor" ? "/doctors/push/subscribe" : "/patients/push/subscribe";

const registerServiceWorker = async () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    throw createPushError(
      "PUSH_SERVICE_WORKER_UNSUPPORTED",
      "Service workers are not available in this browser."
    );
  }

  if (!isSecurePushContext()) {
    throw createPushError(
      "PUSH_INSECURE_CONTEXT",
      "Push notifications require HTTPS or localhost."
    );
  }

  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
};

const ensureNotificationPermission = async () => {
  if (typeof Notification === "undefined") {
    throw createPushError(
      "PUSH_NOTIFICATION_UNSUPPORTED",
      "Notifications are not available in this browser."
    );
  }

  if (Notification.permission === "granted") {
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw createPushError(
      "PUSH_PERMISSION_DENIED",
      "Notification permission was not granted."
    );
  }
};

export function usePushNotifications() {
  const { user } = useAuth();
  const [registration, setRegistration] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const isSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      isSecurePushContext() &&
      Boolean(getVapidPublicKey()) &&
      ["patient", "doctor"].includes(user?.role),
    [user?.role]
  );

  useEffect(() => {
    if (!isSupported) {
      return undefined;
    }

    let isMounted = true;

    registerServiceWorker()
      .then(async (nextRegistration) => {
        const existingSubscription = await nextRegistration.pushManager.getSubscription();

        if (isMounted) {
          setRegistration(nextRegistration);
          setSubscription(existingSubscription);
        }
      })
      .catch(() => {
        if (isMounted) {
          setRegistration(null);
          setSubscription(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isSupported]);

  const subscribe = async () => {
    if (!isSupported) {
      throw createPushError(
        "PUSH_UNSUPPORTED",
        "Push notifications are not available in this browser."
      );
    }

    setLoading(true);

    try {
      const nextRegistration = registration || (await registerServiceWorker());
      await ensureNotificationPermission();

      const existingSubscription =
        subscription || (await nextRegistration.pushManager.getSubscription());
      const nextSubscription =
        existingSubscription ||
        (await nextRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(getVapidPublicKey()),
        }));

      await api.post(getRolePushPath(user.role), nextSubscription.toJSON());
      setRegistration(nextRegistration);
      setSubscription(nextSubscription);
      return nextSubscription;
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    const nextRegistration =
      registration ||
      (isSupported ? await registerServiceWorker().catch(() => null) : null);
    const activeSubscription =
      subscription || (nextRegistration ? await nextRegistration.pushManager.getSubscription() : null);

    if (!activeSubscription) {
      return;
    }

    setLoading(true);

    try {
      const endpoint = activeSubscription.endpoint;
      await activeSubscription.unsubscribe();
      await api.delete(getRolePushPath(user.role), {
        data: { endpoint },
      });
      setRegistration(nextRegistration);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    isSupported,
    isSubscribed: Boolean(subscription),
    loading,
    subscribe,
    unsubscribe,
  };
}

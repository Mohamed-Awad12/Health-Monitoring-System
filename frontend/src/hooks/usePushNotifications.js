import { useEffect, useMemo, useState } from "react";
import { getPushConfiguration } from "../api/authApi";
import api from "../api/axios";
import { useAuth } from "./useAuth";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const EMPTY_PUSH_CONFIG = Object.freeze({
  loaded: false,
  supported: false,
  vapidPublicKey: "",
});

const getEnvVapidPublicKey = () =>
  import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() || "";

const getFallbackPushConfig = () => {
  const vapidPublicKey = getEnvVapidPublicKey();

  return {
    loaded: true,
    supported: Boolean(vapidPublicKey),
    vapidPublicKey,
  };
};

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

const canManagePushForUser = (user) =>
  user?.role === "patient" ||
  (user?.role === "doctor" && user?.doctorVerification?.status === "approved");

const getServiceWorkerUrl = () => {
  if (typeof window === "undefined") {
    return "/sw.js";
  }

  return new URL("sw.js", window.location.origin + (import.meta.env.BASE_URL || "/")).toString();
};

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

  await navigator.serviceWorker.register(getServiceWorkerUrl());
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

const mapPushSubscriptionError = (error) => {
  if (error?.code || error?.response) {
    return error;
  }

  const message = String(error?.message || "").trim();
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("push service error") ||
    normalizedMessage.includes("registration failed")
  ) {
    return createPushError(
      "PUSH_SERVICE_ERROR",
      "Push registration failed. Verify the server VAPID configuration."
    );
  }

  if (
    normalizedMessage.includes("applicationserverkey") ||
    normalizedMessage.includes("base64") ||
    normalizedMessage.includes("invalid character")
  ) {
    return createPushError(
      "PUSH_VAPID_KEY_INVALID",
      "Push notifications are misconfigured. Verify the VAPID public key."
    );
  }

  return createPushError(
    "PUSH_SUBSCRIBE_FAILED",
    message || "Failed to subscribe to push notifications."
  );
};

export function usePushNotifications() {
  const { user } = useAuth();
  const [registration, setRegistration] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pushConfig, setPushConfig] = useState(EMPTY_PUSH_CONFIG);
  const canManagePush = canManagePushForUser(user);
  const isSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      isSecurePushContext() &&
      pushConfig.loaded &&
      pushConfig.supported &&
      Boolean(pushConfig.vapidPublicKey) &&
      canManagePush,
    [canManagePush, pushConfig]
  );

  useEffect(() => {
    if (!canManagePush) {
      setPushConfig({
        loaded: true,
        supported: false,
        vapidPublicKey: "",
      });
      return undefined;
    }

    let isMounted = true;

    getPushConfiguration()
      .then(({ data }) => {
        if (!isMounted) {
          return;
        }

        setPushConfig({
          loaded: true,
          supported: Boolean(data?.push?.supported),
          vapidPublicKey: String(data?.push?.vapidPublicKey || "").trim(),
        });
      })
      .catch(() => {
        if (isMounted) {
          setPushConfig(getFallbackPushConfig());
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canManagePush]);

  useEffect(() => {
    if (!isSupported) {
      setRegistration(null);
      setSubscription(null);
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
      throw createPushError("PUSH_UNSUPPORTED", "Push notifications are not available here.");
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
          applicationServerKey: urlBase64ToUint8Array(pushConfig.vapidPublicKey),
        }));

      await api.post(getRolePushPath(user.role), nextSubscription.toJSON());
      setRegistration(nextRegistration);
      setSubscription(nextSubscription);
      return nextSubscription;
    } catch (error) {
      throw mapPushSubscriptionError(error);
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

import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "./useAuth";

const getVapidPublicKey = () => import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() || "";

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
      Boolean(getVapidPublicKey()) &&
      ["patient", "doctor"].includes(user?.role),
    [user?.role]
  );

  useEffect(() => {
    if (!isSupported) {
      return undefined;
    }

    let isMounted = true;

    navigator.serviceWorker
      .register("/sw.js")
      .then(async (nextRegistration) => {
        const existingSubscription =
          await nextRegistration.pushManager.getSubscription();

        if (isMounted) {
          setRegistration(nextRegistration);
          setSubscription(existingSubscription);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isSupported]);

  const subscribe = async () => {
    if (!isSupported || !registration) {
      return null;
    }

    setLoading(true);

    try {
      const nextSubscription =
        subscription ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(getVapidPublicKey()),
        }));

      await api.post(getRolePushPath(user.role), nextSubscription.toJSON());
      setSubscription(nextSubscription);
      return nextSubscription;
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!subscription) {
      return;
    }

    setLoading(true);

    try {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await api.delete(getRolePushPath(user.role), {
        data: { endpoint },
      });
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

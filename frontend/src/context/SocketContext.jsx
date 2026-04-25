import { createContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../hooks/useAuth";

export const SocketContext = createContext(null);

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const isLocalHost = (hostname) => LOCAL_HOSTS.has(hostname);

const buildSocketUrlFromCurrentHost = () => {
  if (typeof window === "undefined") {
    return "http://localhost:5000";
  }

  return `${window.location.protocol}//${window.location.hostname}:5000`;
};

const shouldUseConfiguredSocketUrl = (configuredSocketUrl) => {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const parsed = new URL(configuredSocketUrl, window.location.origin);
    const configuredIsLocal = isLocalHost(parsed.hostname);
    const currentIsLocal = isLocalHost(window.location.hostname);

    // If the app is opened from another device, ignore localhost socket targets.
    if (configuredIsLocal && !currentIsLocal) {
      return false;
    }

    return true;
  } catch {
    return true;
  }
};

const resolveSocketUrl = () => {
  const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim();

  if (configuredSocketUrl && shouldUseConfiguredSocketUrl(configuredSocketUrl)) {
    return configuredSocketUrl;
  }

  return buildSocketUrlFromCurrentHost();
};

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!token) {
      setSocket((currentSocket) => {
        currentSocket?.disconnect();
        return null;
      });
      return undefined;
    }

    const nextSocket = io(resolveSocketUrl(), {
      auth: { token },
      autoConnect: false,
    });

    // Delay connect by a tick so React StrictMode dev remount cleanup
    // can cancel the initial connect and avoid noisy websocket warnings.
    const connectTimeoutId = window.setTimeout(() => {
      nextSocket.connect();
    }, 0);

    setSocket(nextSocket);

    return () => {
      window.clearTimeout(connectTimeoutId);
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
}

import { createContext, useEffect, useState } from "react";
import {
  getCurrentUser,
  login as loginRequest,
  registerDoctor,
  registerPatient,
} from "../api/authApi";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = window.localStorage.getItem("pulse_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(
    () => window.localStorage.getItem("pulse_token") || null
  );
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (token) {
      window.localStorage.setItem("pulse_token", token);
    } else {
      window.localStorage.removeItem("pulse_token");
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      window.localStorage.setItem("pulse_user", JSON.stringify(user));
    } else {
      window.localStorage.removeItem("pulse_user");
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    if (!token) {
      setLoading(false);
      return undefined;
    }

    getCurrentUser()
      .then(({ data }) => {
        if (isMounted) {
          setUser(data.user);
        }
      })
      .catch(() => {
        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const applySession = ({ token: nextToken, user: nextUser }) => {
    setToken(nextToken);
    setUser(nextUser);
  };

  const login = async (credentials) => {
    const { data } = await loginRequest(credentials);
    applySession(data);
    return data.user;
  };

  const register = async (role, payload) => {
    const request = role === "doctor" ? registerDoctor : registerPatient;
    const { data } = await request(payload);

    if (data.token) {
      applySession(data);
    } else {
      setToken(null);
      setUser(null);
    }

    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

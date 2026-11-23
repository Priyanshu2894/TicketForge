
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { apiGet, apiPost, ApiError } from "../lib/api";
import { AuthContext } from "./auth-context";
import type { AuthUser } from "./types";

const TOKEN_KEY = "ticketforge_access_token";

type LoginResponse = {
  success: boolean;
  data: {
    accessToken: string;
  };
};

type MeResponse = {
  success: boolean;
  data: AuthUser | { user: AuthUser };
};

async function fetchCurrentUser(
  token: string,
  signal?: AbortSignal
): Promise<AuthUser> {
  const response = await apiGet<MeResponse>(
    "/auth/me",
    signal,
    token
  );

  const user =
    "user" in response.data
      ? response.data.user
      : response.data;

  if (
    !user ||
    typeof user.id !== "string" ||
    typeof user.email !== "string" ||
    (user.role !== "CUSTOMER" &&
      user.role !== "ADMIN")
  ) {
    throw new Error("Unexpected user profile response");
  }

  return user;
}

export default function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(
  () => Boolean(sessionStorage.getItem(TOKEN_KEY))
);
  // Restore and verify the previous session on page refresh.
  useEffect(() => {
    const savedToken = sessionStorage.getItem(TOKEN_KEY);

    if (!savedToken) {
  return;
}

    const controller = new AbortController();

    async function restoreSession() {
      try {
        const currentUser = await fetchCurrentUser(
          savedToken!,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setToken(savedToken);
          setUser(currentUser);
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        if (error instanceof ApiError && error.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
        }

        // Do not authenticate a user without verification.
        setToken(null);
        setUser(null);
      } finally {
        if (!controller.signal.aborted) {
          setInitializing(false);
        }
      }
    }

    void restoreSession();

    return () => controller.abort();
  }, []);

  async function login(email: string, password: string) {
    const response = await apiPost<LoginResponse>(
      "/auth/login",
      { email, password }
    );

    const accessToken = response.data.accessToken;

    if (
      typeof accessToken !== "string" ||
      accessToken.length === 0
    ) {
      throw new Error("Login response did not contain a token");
    }

    // Verify the token and get the role from the backend.
    const currentUser = await fetchCurrentUser(accessToken);

    sessionStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
    setUser(currentUser);

    return currentUser;
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        initializing,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

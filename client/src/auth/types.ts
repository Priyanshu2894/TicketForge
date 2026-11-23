
export type UserRole = "CUSTOMER" | "ADMIN";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  initializing: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<AuthUser>;
  logout: () => void;
};

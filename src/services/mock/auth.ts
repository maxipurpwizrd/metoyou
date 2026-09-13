type MockUser = {
  id: string;
  email: string;
  password: string;
  username: string;
  firstName?: string;
  lastName?: string;
  language?: string;
  dateOfBirth?: string;
  gender?: string;
};

type AuthUser = {
  id: string;
  email: string;
};

type AuthStateChangeCallback = (user: AuthUser | null) => void;

type AuthChangeListener = AuthStateChangeCallback;

import { userService } from "./users";

type AuthSession = {
  userId: string;
  email: string;
  loggedInAt: number;
};

const MOCK_AUTH_USERS_KEY = "metoyou-mock-auth-users";
const MOCK_AUTH_SESSION_KEY = "metoyou-mock-auth-session";

const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readAuthUsers(): MockUser[] {
  if (!isBrowser) return [];
  return safeParse<MockUser[]>(window.localStorage.getItem(MOCK_AUTH_USERS_KEY)) ?? [];
}

function writeAuthUsers(users: MockUser[]) {
  if (!isBrowser) return;
  window.localStorage.setItem(MOCK_AUTH_USERS_KEY, JSON.stringify(users));
}

function readAuthSession(): AuthSession | null {
  if (!isBrowser) return null;
  return safeParse<AuthSession>(window.localStorage.getItem(MOCK_AUTH_SESSION_KEY));
}

function writeAuthSession(session: AuthSession | null) {
  if (!isBrowser) return;
  if (!session) {
    window.localStorage.removeItem(MOCK_AUTH_SESSION_KEY);
    return;
  }
  window.localStorage.setItem(MOCK_AUTH_SESSION_KEY, JSON.stringify(session));
}

function createMockId(prefix = "mock") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function createUsername(email: string, firstName?: string, lastName?: string) {
  const baseName = `${firstName || ""} ${lastName || ""}`.trim() || email.split("@")[0] || "mockuser";
  const normalized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "mockuser";
  const existing = readAuthUsers().map((user) => user.username);
  if (!existing.includes(normalized)) return normalized;
  let suffix = 1;
  while (existing.includes(`${normalized}-${suffix}`)) {
    suffix += 1;
  }
  return `${normalized}-${suffix}`;
}

export const authService = {
  login: async (email: string, password: string) => {
    const users = readAuthUsers();
    const existing = users.find((user) => user.email.toLowerCase() === email.trim().toLowerCase());
    if (!existing || existing.password !== password) {
      throw new Error("Invalid email or password.");
    }

    const session: AuthSession = {
      userId: existing.id,
      email: existing.email,
      loggedInAt: Date.now(),
    };
    writeAuthSession(session);
    notifyAuthStateChange();

    return { user: { id: existing.id, email: existing.email } };
  },

  logout: async () => {
    writeAuthSession(null);
    notifyAuthStateChange();
    return { success: true };
  },

  signUp: async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    language?: string,
    dateOfBirth?: string,
    gender?: string
  ) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      throw new Error("Email and password are required.");
    }

    const users = readAuthUsers();
    if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
      throw new Error("An account already exists for this email.");
    }

    const newUser: MockUser = {
      id: createMockId("user"),
      email: normalizedEmail,
      password,
      username: createUsername(normalizedEmail, firstName, lastName),
      firstName: firstName?.trim() || undefined,
      lastName: lastName?.trim() || undefined,
      language: language?.trim() || undefined,
      dateOfBirth: dateOfBirth?.trim() || undefined,
      gender: gender?.trim() || undefined,
    };

    users.push(newUser);
    writeAuthUsers(users);

    await userService.upsertProfile({
      id: newUser.id,
      username: newUser.username,
      bio: "",
      profilePic: null,
      interests: [],
      email: newUser.email,
      language: newUser.language ?? "en-basic",
      hommies_count: 0,
      snapshots_count: 0,
      vibes_count: 0,
      dateOfBirth: newUser.dateOfBirth ?? "",
      gender: newUser.gender ?? "",
    });

    const session: AuthSession = {
      userId: newUser.id,
      email: newUser.email,
      loggedInAt: Date.now(),
    };
    writeAuthSession(session);
    notifyAuthStateChange();

    return { user: { id: newUser.id, email: newUser.email } };
  },
};

const authChangeListeners = new Set<AuthChangeListener>();

export function getCurrentUser(): AuthUser | null {
  const session = readAuthSession();
  if (!session) return null;
  return { id: session.userId, email: session.email };
}

export function onAuthStateChange(callback: AuthStateChangeCallback) {
  authChangeListeners.add(callback);
  callback(getCurrentUser());

  return () => {
    authChangeListeners.delete(callback);
  };
}

function notifyAuthStateChange() {
  const currentUser = getCurrentUser();
  for (const callback of authChangeListeners) {
    try {
      callback(currentUser);
    } catch {
      // ignore listener errors
    }
  }
}

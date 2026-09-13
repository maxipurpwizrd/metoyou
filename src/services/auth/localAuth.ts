import { authService as mockAuthService, getCurrentUser as getMockCurrentUser, onAuthStateChange as onMockAuthStateChange } from "../mock/auth";
import type { AuthUser, AuthStateChangeCallback } from "./supabaseAuth";

export async function getCurrentUser(): Promise<AuthUser | null> {
  return getMockCurrentUser();
}

export const authService = {
  login: mockAuthService.login,
  logout: mockAuthService.logout,
  signUp: mockAuthService.signUp,
  getCurrentUser,
  onAuthStateChange: onMockAuthStateChange,
};

export type { AuthUser, AuthStateChangeCallback };

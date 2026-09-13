import { BACKEND } from "@/config/backend";
import type { AuthStateChangeCallback, AuthUser } from "./supabaseAuth";
import { authService as localAuthService } from "./localAuth";
import { authService as supabaseAuthService } from "./supabaseAuth";

export type { AuthUser, AuthStateChangeCallback } from "./supabaseAuth";

export const authService = BACKEND === "mock" ? localAuthService : supabaseAuthService;

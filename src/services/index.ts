import { BACKEND } from "@/config/backend";
import { adminReports as supabaseAdminReports } from "./supabase/adminReportService";
import { authService as authServiceImpl } from "./auth/authService";
import { chatService as supabaseChatService } from "./supabase/chat";
import { userService as supabaseUserService } from "./supabase/users";
import { presenceService as supabasePresenceService } from "./supabase/presence";
import { adminReports as mockAdminReports } from "./mock/adminReportService";
import { chatService as mockChatService } from "./mock/chat";
import { userService as mockUserService } from "./mock/users";
import { presenceService as mockPresenceService } from "./mock/presence";

export const authService = authServiceImpl;
export const chatService = BACKEND === "mock" ? mockChatService : supabaseChatService;
export const userService = BACKEND === "mock" ? mockUserService : supabaseUserService;
export const presenceService = BACKEND === "mock" ? mockPresenceService : supabasePresenceService;
export const adminReports = BACKEND === "mock" ? mockAdminReports : supabaseAdminReports;

import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, type ReactNode } from "react";
import ScrollRestoration from "./lib/ScrollRestoration";
import { LanguageProvider } from "./contexts/LanguageContext";
import { VideoProvider } from "./contexts/VideoContext";
import { ChatProvider } from "./contexts/ChatContext";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

import Home from "./pages/Home";
import Feed from "./pages/Feed";
import Clips from "./pages/Clips";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AuthChoice from "./pages/AuthChoice";
import AboutMeToYou from "./pages/AboutMeToYou";
import Chat from "./pages/Chat";
import Messages from "./pages/Messages";
import SpamMessages from "./pages/SpamMessages";
import ArchivedMessages from "./pages/ArchivedMessages";
import CallHistory from "./pages/CallHistory";
import Notifications from "./pages/Notifications";
import Search from "./pages/Search";
import AdminDashboard from "./pages/AdminDashboard";
import AdminPosts from "./pages/AdminPosts";
import AdminUsers from "./pages/AdminUsers";
import VibesProUpgrade from "./pages/VibesProUpgrade";
import VibesProSuccess from "./pages/VibesProSuccess";
import RequireAuth from "./components/RequireAuth";
import { useAuth } from "./hooks/useAuth";
import { GlobalCallProvider } from "./contexts/GlobalCallContext";
import { shouldRedirectAuthenticatedPublicRoute } from "./lib/authStateIsolation";

const LAST_ROUTE_STORAGE_KEY = "metoyou:last-auth-route";
const PUBLIC_ROUTES = new Set(["/", "/welcome", "/login", "/signup", "/about"]);
const BACK_REDIRECT_ROUTES = new Set([
  "/notifications",
  "/search",
  "/messages",
  "/messages/spam",
  "/messages/archived",
  "/chat",
  "/profile",
  "/settings",
  "/settings/vibes-pro",
  "/vibes-pro/success",
  "/admin-dashboard",
  "/admin-users",
  "/admin-posts",
  "/clips",
]);

function shouldRedirectToFeed(pathname: string) {
  if (pathname === "/feed") return false;
  if (PUBLIC_ROUTES.has(pathname)) return false;
  if (pathname.startsWith("/profile/")) return true;
  if (pathname.startsWith("/messages/")) return true;
  if (pathname.startsWith("/settings/")) return true;
  return BACK_REDIRECT_ROUTES.has(pathname);
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading || !user) return;

    const publicPaths = ["/", "/welcome", "/login", "/signup"];
    if (!publicPaths.includes(location.pathname)) return;

    if (shouldRedirectAuthenticatedPublicRoute(location.pathname, user.id)) {
      window.sessionStorage.removeItem(LAST_ROUTE_STORAGE_KEY);
      navigate("/feed", { replace: true });
      return;
    }

    const savedRoute = window.sessionStorage.getItem(LAST_ROUTE_STORAGE_KEY);
    const target = savedRoute && savedRoute.startsWith("/") ? savedRoute : "/feed";
    navigate(target, { replace: true });
  }, [isLoading, location.pathname, navigate, user]);

  if (isLoading) return null;
  return user ? null : <>{children}</>;
}

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const previousPathRef = useRef<string | null>(null);
  const lastNonFeedPathRef = useRef<string | null>(null);

  useEffect(() => {
    const currentPath = `${location.pathname}${location.search}`;
    if (location.pathname !== "/login" && location.pathname !== "/signup" && location.pathname !== "/welcome") {
      window.sessionStorage.setItem(LAST_ROUTE_STORAGE_KEY, currentPath);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (location.pathname === "/login" || location.pathname === "/signup") {
      window.sessionStorage.removeItem(LAST_ROUTE_STORAGE_KEY);
    }
  }, [location.pathname]);

  useEffect(() => {
    const currentPath = `${location.pathname}${location.search}`;
    const isFeedRoute = location.pathname === "/feed";
    const shouldTrack = !PUBLIC_ROUTES.has(location.pathname) && !isFeedRoute;

    if (isFeedRoute) {
      previousPathRef.current = currentPath;
      return;
    }

    if (shouldTrack) {
      lastNonFeedPathRef.current = currentPath;
    }

    previousPathRef.current = currentPath;
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handlePopState = () => {
      const currentPath = `${location.pathname}${location.search}`;
      const shouldRedirect = shouldRedirectToFeed(location.pathname);

      if (shouldRedirect) {
        navigate("/feed", { replace: true });
        return;
      }

      if (currentPath === "/feed") {
        return;
      }

      if (previousPathRef.current && previousPathRef.current !== currentPath) {
        navigate("/feed", { replace: true });
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [location.pathname, location.search, navigate]);

  return (
    <Routes>
      <Route path="/" element={<PublicRoute><Home /></PublicRoute>} />
      <Route path="/feed" element={<RequireAuth><Feed /></RequireAuth>} />
      <Route path="/clips" element={<RequireAuth><Clips /></RequireAuth>} />
      <Route path="/welcome" element={<PublicRoute><AuthChoice /></PublicRoute>} />
      <Route path="/about" element={<AboutMeToYou />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="/profile/:username" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
      <Route path="/settings/vibes-pro" element={<RequireAuth><VibesProUpgrade /></RequireAuth>} />
      <Route path="/vibes-pro/success" element={<RequireAuth><VibesProSuccess /></RequireAuth>} />
      <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
      <Route path="/messages/spam" element={<RequireAuth><SpamMessages /></RequireAuth>} />
      <Route path="/messages/archived" element={<RequireAuth><ArchivedMessages /></RequireAuth>} />
      <Route path="/messages/calls" element={<RequireAuth><CallHistory /></RequireAuth>} />
      <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
      <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
      <Route path="/search" element={<RequireAuth><Search /></RequireAuth>} />
      <Route path="/admin-dashboard" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
      <Route path="/admin-users" element={<RequireAuth><AdminUsers /></RequireAuth>} />
      <Route path="/admin-posts" element={<RequireAuth><AdminPosts /></RequireAuth>} />
    </Routes>
  );
}

function App() {
  return (
    <LanguageProvider>
      <VideoProvider>
        <ChatProvider>
          <BrowserRouter>
            <GlobalCallProvider>
              <ScrollRestoration />
              <AppRoutes />
              <PWAInstallPrompt />
            </GlobalCallProvider>
          </BrowserRouter>
        </ChatProvider>
      </VideoProvider>
    </LanguageProvider>
  );
}

export default App;
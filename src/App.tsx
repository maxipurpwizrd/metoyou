import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import ScrollRestoration from "./lib/ScrollRestoration";
import { LanguageProvider } from "./contexts/LanguageContext";
import { VideoProvider } from "./contexts/VideoContext";
import { ChatProvider } from "./contexts/ChatContext";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

import Home from "./pages/Home";
import Feed from "./pages/Feed";
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
import Notifications from "./pages/Notifications";
import Search from "./pages/Search";
import AdminDashboard from "./pages/AdminDashboard";
import AdminPosts from "./pages/AdminPosts";
import AdminUsers from "./pages/AdminUsers";
import VibesProUpgrade from "./pages/VibesProUpgrade";
import VibesProSuccess from "./pages/VibesProSuccess";
import RequireAuth from "./components/RequireAuth";
import { useAuth } from "./hooks/useAuth";

const LAST_ROUTE_STORAGE_KEY = "metoyou:last-auth-route";

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading || !user) return;

    const publicPaths = ["/", "/welcome", "/login", "/signup"];
    if (!publicPaths.includes(location.pathname)) return;

    const savedRoute = window.sessionStorage.getItem(LAST_ROUTE_STORAGE_KEY);
    const target = savedRoute && savedRoute.startsWith("/") ? savedRoute : "/feed";
    navigate(target, { replace: true });
  }, [isLoading, location.pathname, navigate, user]);

  if (isLoading) return null;
  return user ? null : <>{children}</>;
}

function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    const currentPath = `${location.pathname}${location.search}`;
    if (location.pathname !== "/login" && location.pathname !== "/signup" && location.pathname !== "/welcome") {
      window.sessionStorage.setItem(LAST_ROUTE_STORAGE_KEY, currentPath);
    }
  }, [location.pathname, location.search]);

  return (
    <Routes>
      <Route path="/" element={<PublicRoute><Home /></PublicRoute>} />
      <Route path="/feed" element={<RequireAuth><Feed /></RequireAuth>} />
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
            <ScrollRestoration />
            <AppRoutes />
            <PWAInstallPrompt />
          </BrowserRouter>
        </ChatProvider>
      </VideoProvider>
    </LanguageProvider>
  );
}

export default App;
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import Chat from "./pages/Chat";
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";
import Search from "./pages/Search";
import AdminDashboard from "./pages/AdminDashboard";
import AdminPosts from "./pages/AdminPosts";
import AdminUsers from "./pages/AdminUsers";
import VibesProUpgrade from "./pages/VibesProUpgrade";
import VibesProSuccess from "./pages/VibesProSuccess";
import RequireAuth from "./components/RequireAuth";

function App() {
  return (
    <LanguageProvider>
      <VideoProvider>
        <ChatProvider>
          <BrowserRouter>
            <ScrollRestoration />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/feed" element={<RequireAuth><Feed /></RequireAuth>} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/profile/:username" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
              <Route path="/settings/vibes-pro" element={<RequireAuth><VibesProUpgrade /></RequireAuth>} />
              <Route path="/vibes-pro/success" element={<RequireAuth><VibesProSuccess /></RequireAuth>} />
              <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
              <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
              <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
              <Route path="/search" element={<RequireAuth><Search /></RequireAuth>} />
              <Route path="/admin-dashboard" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/admin-users" element={<RequireAuth><AdminUsers /></RequireAuth>} />
              <Route path="/admin-posts" element={<RequireAuth><AdminPosts /></RequireAuth>} />
            </Routes>
            <PWAInstallPrompt />
          </BrowserRouter>
        </ChatProvider>
      </VideoProvider>
    </LanguageProvider>
  );
}

export default App;
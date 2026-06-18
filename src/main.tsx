import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { LanguageProvider } from "./contexts/LanguageContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <div className="relative min-h-screen overflow-hidden">

        {/* Background Blob 1 */}
        <div className="fixed top-0 left-0 w-96 h-96 bg-pink-400/30 blur-[120px] rounded-full animate-pulse pointer-events-none"></div>

        {/* Background Blob 2 */}
        <div className="fixed bottom-0 right-0 w-96 h-96 bg-purple-500/30 blur-[120px] rounded-full animate-pulse pointer-events-none"></div>

        {/* Background Blob 3 */}
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-400/20 blur-[150px] rounded-full pointer-events-none"></div>

        <App />
      </div>
    </LanguageProvider>
  </StrictMode>
);
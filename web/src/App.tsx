import { useState, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import CommandPalette from "./components/CommandPalette";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardPage from "./pages/Dashboard";
import ProjectsPage from "./pages/Projects";
import EndpointsPage from "./pages/Endpoints";
import HistoryPage from "./pages/History";
import SettingsPage from "./pages/Settings";

const FlowsPage = lazy(() => import("./pages/Flows"));

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("sb-collapsed") === "1"
  );

  const toggleSidebar = () => {
    setSidebarCollapsed((v) => {
      const next = !v;
      localStorage.setItem("sb-collapsed", next ? "1" : "0");
      return next;
    });
  };

  return (
    <div className="h-full flex">
      <a href="#main-content" className="skip-link">
        跳到主要内容
      </a>
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <TopBar />
        <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/endpoints" element={<EndpointsPage />} />
              <Route path="/flows" element={
                <Suspense fallback={<div className="p-8 text-slate-400 text-sm">加载中…</div>}>
                  <FlowsPage />
                </Suspense>
              } />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>

      {/* Global overlays */}
      <CommandPalette />
    </div>
  );
}

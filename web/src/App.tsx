import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import DashboardPage from "./pages/Dashboard";
import ProjectsPage from "./pages/Projects";
import EndpointsPage from "./pages/Endpoints";
import FlowsPage from "./pages/Flows";
import HistoryPage from "./pages/History";
import SettingsPage from "./pages/Settings";

export default function App() {
  return (
    <div className="h-full flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/endpoints" element={<EndpointsPage />} />
            <Route path="/flows" element={<FlowsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

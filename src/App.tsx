import "./styles/maplibre.css";
import "./styles/pwa-enhancements.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { PermissionProvider } from "./contexts/PermissionContext";
import { pwaManager } from "./utils/pwa";
import { useEffect } from "react";
import RootRedirect from "./pages/Root";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard";
import ManagerDashboard from "./pages/dashboards/ManagerDashboard";
import SupervisorDashboard from "./pages/dashboards/SupervisorDashboard";
import Tasks from "./pages/Tasks";
import Locations from "./pages/Locations";
import Chat from "./pages/Chat";
import PettyCash from "./pages/PettyCash";
import Inventory from "./pages/Inventory";
import Geofences from "./pages/Geofences";
import UserManagement from "./pages/UserManagement";
import Reports from "./pages/Reports";
import Jobs from "./pages/Jobs";
import PermissionManagement from "./pages/PermissionManagement";
import Meet from "./pages/Meet";
import EmployeeTracking from "./pages/EmployeeTracking";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Initialize PWA manager
    pwaManager.requestNotificationPermission();
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PermissionProvider>
            <NotificationProvider>
              <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/admin" element={<Dashboard />} />
            <Route path="/dashboard/manager" element={<ManagerDashboard />} />
            <Route path="/dashboard/supervisor" element={<SupervisorDashboard />} />
            <Route path="/dashboard/employee" element={<EmployeeDashboard />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/petty-cash" element={<PettyCash />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/geofences" element={<Geofences />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/permissions" element={<PermissionManagement />} />
            <Route path="/meet" element={<Meet />} />
            <Route path="/tracking" element={<EmployeeTracking />} />
            {/* Catch-all route removed per request */}
            </Routes>
            </NotificationProvider>
          </PermissionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;

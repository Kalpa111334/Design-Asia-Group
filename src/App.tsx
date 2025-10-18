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
import { TimerProvider } from "./contexts/TimerContext";
import { pwaManager } from "./utils/pwa";
import { useEffect, Suspense, lazy } from "react";
import RootRedirect from "./pages/Root";
import ErrorBoundary from "./components/ErrorBoundary";

// Route-based code splitting
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const EmployeeDashboard = lazy(() => import("./pages/dashboards/EmployeeDashboard"));
const ManagerDashboard = lazy(() => import("./pages/dashboards/ManagerDashboard"));
const SupervisorDashboard = lazy(() => import("./pages/dashboards/SupervisorDashboard"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Locations = lazy(() => import("./pages/Locations"));
const Chat = lazy(() => import("./pages/Chat"));
const PettyCash = lazy(() => import("./pages/PettyCash"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Geofences = lazy(() => import("./pages/Geofences"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const Reports = lazy(() => import("./pages/Reports"));
const Jobs = lazy(() => import("./pages/Jobs"));
const PermissionManagement = lazy(() => import("./pages/PermissionManagement"));
const Meet = lazy(() => import("./pages/Meet"));
const EmployeeTracking = lazy(() => import("./pages/EmployeeTracking"));
const NotificationCenter = lazy(() => import("./pages/NotificationCenter"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Initialize PWA manager and push notifications
    const initializePWA = async () => {
      try {
        await pwaManager.requestNotificationPermission();
        await pwaManager.initializePushNotifications();
      } catch (error) {
        console.error('Failed to initialize PWA features:', error);
      }
    };
    
    initializePWA();
  }, []);

  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <PermissionProvider>
              <NotificationProvider>
                <TimerProvider>
                  <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-6 text-muted-foreground">Loading...</div>}>
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
                  <Route path="/notifications" element={<NotificationCenter />} />
                  {/* Catch-all route for 404 handling */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
                </TimerProvider>
              </NotificationProvider>
            </PermissionProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;

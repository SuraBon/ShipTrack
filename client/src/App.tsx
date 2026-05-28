import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import AppLoading from "./components/AppLoading";
import Login from "./pages/Login";
import { isConfigured, loadBranches, onConfigUpdated } from "./lib/parcelService";
import { useAuth } from "./contexts/AuthContext";
import { normalizeRole } from "./lib/roles";
import { canAccessPage, getVisiblePage } from "./lib/permissionHelper";
import { useAppRouter } from "./hooks/useAppRouter";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const CreateParcel = lazy(() => import("./pages/CreateParcel"));
const Track = lazy(() => import("./pages/Track"));
const ParcelActivityLog = lazy(() => import("./pages/ParcelActivityLog"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const BranchManagement = lazy(() => import("./pages/BranchManagement"));

const PageFallback = () => <AppLoading label="กำลังเปิดหน้า" />;

function App() {
  const { user, loading } = useAuth();
  const { currentPage, navigateToPage } = useAppRouter();
  const [isConfiguredState, setIsConfiguredState] = useState(isConfigured());
  const [, setConfigVersion] = useState(0);

  useEffect(() => {
    const handleUpdateAvailable = (event: Event) => {
      const updateServiceWorker = (event as CustomEvent<{ updateServiceWorker?: (reloadPage?: boolean) => Promise<void> }>).detail?.updateServiceWorker;
      toast.info("มีเวอร์ชันใหม่พร้อมใช้งาน", {
        description: "กดเตรียมอัปเดต แล้วเปิดแอปใหม่เมื่อสะดวก",
        duration: 15000,
        action: {
          label: "เตรียมอัปเดต",
          onClick: () => void updateServiceWorker?.(false),
        },
        cancel: {
          label: "ภายหลัง",
          onClick: () => undefined,
        },
      });
    };
    const handleOfflineReady = () => {
      toast.success("พร้อมใช้งานแบบออฟไลน์แล้ว");
    };

    window.addEventListener("shiptrack:pwa-update", handleUpdateAvailable);
    window.addEventListener("shiptrack:pwa-offline-ready", handleOfflineReady);
    return () => {
      window.removeEventListener("shiptrack:pwa-update", handleUpdateAvailable);
      window.removeEventListener("shiptrack:pwa-offline-ready", handleOfflineReady);
    };
  }, []);

  useEffect(() => {
    const updateConfig = () => {
      setIsConfiguredState(isConfigured());
      setConfigVersion(version => version + 1);
    };
    const unsubscribe = onConfigUpdated(updateConfig);
    updateConfig();
    void loadBranches().finally(updateConfig);
    return unsubscribe;
  }, []);



  useEffect(() => {
    if (loading) return;

    const role = user ? normalizeRole(user.role) : "GUEST";
    if (!canAccessPage(currentPage, role)) {
      navigateToPage(role === "GUEST" ? "create" : "dashboard");
    }
  }, [currentPage, loading, navigateToPage, user]);

  if (loading) {
    return <AppLoading fullScreen />;
  }

  const role = user ? normalizeRole(user.role) : "GUEST";
  if (!user && currentPage === "login") {
    return (
      <ErrorBoundary>
        <ThemeProvider defaultTheme="light" switchable={true}>
          <Toaster />
          <Login />
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  const visiblePage = getVisiblePage(currentPage, role);
  const renderCurrentPage = () => {
    switch (visiblePage) {
      case "dashboard":
        return <ErrorBoundary><Dashboard isConfigured={isConfiguredState} /></ErrorBoundary>;
      case "create":
        return <ErrorBoundary><CreateParcel /></ErrorBoundary>;
      case "parcelActivity":
        return <ErrorBoundary><ParcelActivityLog /></ErrorBoundary>;
      case "auditLogs":
        return <ErrorBoundary><AuditLog /></ErrorBoundary>;
      case "users":
        return <ErrorBoundary><UserManagement /></ErrorBoundary>;
      case "branches":
        return <ErrorBoundary><BranchManagement /></ErrorBoundary>;
      case "track":
        return <ErrorBoundary><Track /></ErrorBoundary>;
      case "login":
        return <ErrorBoundary><Login /></ErrorBoundary>;
      default:
        return <ErrorBoundary><Track /></ErrorBoundary>;
    }
  };

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <TooltipProvider>
          <Toaster />
          <Layout currentPage={visiblePage} setCurrentPage={navigateToPage}>
            <Suspense fallback={<PageFallback />}>
              {renderCurrentPage()}
            </Suspense>
          </Layout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

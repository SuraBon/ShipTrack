import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import { isConfigured, loadBranches, onConfigUpdated } from "./lib/parcelService";
import { useAuth } from "./contexts/AuthContext";
import { normalizeRole } from "./lib/roles";
import { canAccessPage, getVisiblePage, type PageId } from "./lib/permissionHelper";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const CreateParcel = lazy(() => import("./pages/CreateParcel"));
const Track = lazy(() => import("./pages/Track"));
const ParcelActivityLog = lazy(() => import("./pages/ParcelActivityLog"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const BranchManagement = lazy(() => import("./pages/BranchManagement"));

const pagePaths: Record<PageId, string> = {
  dashboard: "/dashboard",
  create: "/create",
  track: "/track",
  parcelActivity: "/parcel-activity",
  auditLogs: "/audit-logs",
  users: "/users",
  branches: "/branches",
  login: "/login",
};

const pathPages: Record<string, PageId> = {
  "/": "dashboard",
  "/dashboard": "dashboard",
  "/create": "create",
  "/track": "track",
  "/parcel-activity": "parcelActivity",
  "/audit-logs": "auditLogs",
  "/users": "users",
  "/branches": "branches",
  "/login": "login",
};

const getRouteFromLocation = (): { page: PageId; isKnownPath: boolean } => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const page = pathPages[path];
  return page ? { page, isKnownPath: true } : { page: "create", isKnownPath: false };
};

const AppLoading = ({ fullScreen = false }: { fullScreen?: boolean }) => (
  <div className={`grid place-items-center bg-background px-4 ${fullScreen ? "min-h-screen" : "min-h-[56vh]"}`}>
    <div className="flex w-full max-w-[280px] flex-col items-center rounded-2xl border border-outline-variant/20 bg-white px-6 py-7 text-center shadow-sm">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white shadow-sm">
        <span className="material-symbols-outlined text-2xl">inventory_2</span>
      </div>
      <div className="mt-4">
        <p className="font-display text-base font-black leading-tight text-primary">ShipTrack</p>
        <p className="mt-1 text-xs font-semibold text-on-surface-variant/55">กำลังเตรียมข้อมูล</p>
      </div>
      <div className="mt-5 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/35 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/50 [animation-delay:120ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/70 [animation-delay:240ms]" />
      </div>
    </div>
  </div>
);

const PageFallback = () => <AppLoading />;

function App() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageId>(() => {
    const route = getRouteFromLocation();
    if (!route.isKnownPath) {
      window.history.replaceState({}, "", pagePaths.create);
    }
    return route.page;
  });
  const [isConfiguredState, setIsConfiguredState] = useState(isConfigured());
  const [, setConfigVersion] = useState(0);

  useEffect(() => {
    const handleUpdateAvailable = (event: Event) => {
      const updateServiceWorker = (event as CustomEvent<{ updateServiceWorker?: (reloadPage?: boolean) => Promise<void> }>).detail?.updateServiceWorker;
      toast.info("มีเวอร์ชันใหม่พร้อมใช้งาน", {
        description: "กดอัปเดตเพื่อโหลดแอปล่าสุด",
        duration: Infinity,
        action: {
          label: "อัปเดต",
          onClick: () => void updateServiceWorker?.(true),
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
    const handlePopState = () => {
      const route = getRouteFromLocation();
      setCurrentPage(route.page);
      if (!route.isKnownPath) {
        window.history.replaceState({}, "", pagePaths.create);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateToPage = useCallback((page: PageId) => {
    setCurrentPage(page);
    const nextPath = pagePaths[page];
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
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
        <ThemeProvider defaultTheme="light">
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
      <ThemeProvider defaultTheme="light">
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

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import { isConfigured, onConfigUpdated } from "./lib/parcelService";
import { useAuth } from "./contexts/AuthContext";
import { normalizeRole, type AppRole } from "./lib/roles";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const CreateParcel = lazy(() => import("./pages/CreateParcel"));
const Track = lazy(() => import("./pages/Track"));
const UserManagement = lazy(() => import("./pages/UserManagement"));

type PageId = "dashboard" | "create" | "track" | "users";

const pagePaths: Record<PageId, string> = {
  dashboard: "/dashboard",
  create: "/create",
  track: "/track",
  users: "/users",
};

const pathPages: Record<string, PageId> = {
  "/": "dashboard",
  "/dashboard": "dashboard",
  "/create": "create",
  "/track": "track",
  "/users": "users",
};

const getRouteFromLocation = (): { page: PageId; isKnownPath: boolean } => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const page = pathPages[path];
  return page ? { page, isKnownPath: true } : { page: "dashboard", isKnownPath: false };
};

const pageRoles: Record<PageId, AppRole[]> = {
  dashboard: ["ADMIN", "MESSENGER", "USER"],
  create: ["ADMIN"],
  track: ["ADMIN"],
  users: ["ADMIN"],
};

const canAccessPage = (page: PageId, role: AppRole) => pageRoles[page].includes(role);

const PageFallback = () => (
  <div className="grid min-h-[60vh] place-items-center bg-surface">
    <div className="flex flex-col items-center gap-3 text-primary">
      <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
      <p className="text-sm font-black">กำลังโหลดหน้า...</p>
    </div>
  </div>
);

function App() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageId>(() => {
    const route = getRouteFromLocation();
    if (!route.isKnownPath) {
      window.history.replaceState({}, "", pagePaths.track);
    }
    return route.page;
  });
  const [isConfiguredState, setIsConfiguredState] = useState(isConfigured());

  useEffect(() => {
    const updateConfig = () => setIsConfiguredState(isConfigured());
    const unsubscribe = onConfigUpdated(updateConfig);
    updateConfig();
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteFromLocation();
      setCurrentPage(route.page);
      if (!route.isKnownPath) {
        window.history.replaceState({}, "", pagePaths.track);
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
    if (loading || !user) return;

    const role = normalizeRole(user.role);
    if (!canAccessPage(currentPage, role)) {
      navigateToPage("dashboard");
    }
  }, [currentPage, loading, navigateToPage, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <ThemeProvider defaultTheme="light">
          <Toaster />
          <Login />
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  const role = normalizeRole(user.role);
  const visiblePage = canAccessPage(currentPage, role) ? currentPage : "dashboard";
  const renderCurrentPage = () => {
    switch (visiblePage) {
      case "dashboard":
        return <ErrorBoundary><Dashboard isConfigured={isConfiguredState} /></ErrorBoundary>;
      case "create":
        return <ErrorBoundary><CreateParcel /></ErrorBoundary>;
      case "users":
        return <ErrorBoundary><UserManagement /></ErrorBoundary>;
      case "track":
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

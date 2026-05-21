import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import { isConfigured, onConfigUpdated } from "./lib/parcelService";
import { useAuth } from "./contexts/AuthContext";
import { normalizeRole } from "./lib/roles";
import { canAccessPage, getVisiblePage, type PageId } from "./lib/permissionHelper";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const CreateParcel = lazy(() => import("./pages/CreateParcel"));
const Track = lazy(() => import("./pages/Track"));
const UserManagement = lazy(() => import("./pages/UserManagement"));

const pagePaths: Record<PageId, string> = {
  dashboard: "/dashboard",
  create: "/create",
  track: "/track",
  users: "/users",
  login: "/login",
};

const pathPages: Record<string, PageId> = {
  "/": "dashboard",
  "/dashboard": "dashboard",
  "/create": "create",
  "/track": "track",
  "/users": "users",
  "/login": "login",
};

const getRouteFromLocation = (): { page: PageId; isKnownPath: boolean } => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const page = pathPages[path];
  return page ? { page, isKnownPath: true } : { page: "create", isKnownPath: false };
};

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
      window.history.replaceState({}, "", pagePaths.create);
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </div>
    );
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
      case "users":
        return <ErrorBoundary><UserManagement /></ErrorBoundary>;
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

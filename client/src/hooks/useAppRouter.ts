import { useCallback, useEffect, useState } from "react";
import { type PageId } from "../lib/permissionHelper";

export const pagePaths: Record<PageId, string> = {
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

export const getRouteFromLocation = (): { page: PageId; isKnownPath: boolean } => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const page = pathPages[path];
  return page ? { page, isKnownPath: true } : { page: "create", isKnownPath: false };
};

export function useAppRouter() {
  const [currentPage, setCurrentPage] = useState<PageId>(() => {
    const route = getRouteFromLocation();
    if (!route.isKnownPath) {
      window.history.replaceState({}, "", pagePaths.create);
    }
    return route.page;
  });

  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteFromLocation();
      if (currentPage === "create" && route.page !== "create" && sessionStorage.getItem("shiptrack:create_parcel_dirty") === "true") {
        const confirmLeave = window.confirm("คุณมีข้อมูลที่กำลังกรอกค้างอยู่ ต้องการออกจากหน้านี้หรือไม่? (ข้อมูลร่างของคุณจะยังคงอยู่)");
        if (!confirmLeave) {
          window.history.pushState({}, "", pagePaths.create);
          return;
        }
      }
      setCurrentPage(route.page);
      if (!route.isKnownPath) {
        window.history.replaceState({}, "", pagePaths.create);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentPage]);

  const navigateToPage = useCallback((page: PageId) => {
    if (currentPage === "create" && page !== "create" && sessionStorage.getItem("shiptrack:create_parcel_dirty") === "true") {
      const confirmLeave = window.confirm("คุณมีข้อมูลที่กำลังกรอกค้างอยู่ ต้องการออกจากหน้านี้หรือไม่? (ข้อมูลร่างของคุณจะยังคงอยู่)");
      if (!confirmLeave) {
        return;
      }
    }
    setCurrentPage(page);
    const nextPath = pagePaths[page];
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
  }, [currentPage]);

  return {
    currentPage,
    forceSetPage: setCurrentPage,
    navigateToPage,
  };
}

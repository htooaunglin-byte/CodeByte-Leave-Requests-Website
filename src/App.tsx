import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Wifi, 
  WifiOff, 
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Calendar,
  Bell,
  Briefcase,
  Laptop,
  Settings as SettingsIcon
} from "lucide-react";
import { teamService, auth, db, leaveService, adminService, assetService } from "./firebase";
import { signOut } from "firebase/auth";
import {
  TeamMember,
  LeaveRequest,
  AdminUser,
  CompanyAsset,
  AssetAssignment,
  AssetActivityLog,
  AssetCondition,
  getDaysDifference,
  formatWithDayOfWeek,
  getRentalAlertInfo,
} from "./types";
import Logo from "./components/Logo";
import Login from "./components/Login";
import TeamManagement from "./components/TeamManagement";
import LeaveRequests from "./components/LeaveRequests";
import CompanyAssets from "./components/CompanyAssets";
import Settings from "./components/Settings";

const formatDateWithDayOfWeek = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    }
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
};

export type ViewType = "leave-requests" | "company-assets" | "team-management" | "settings";

const FAKE_DEMO_EMAILS = new Set([
  "sarah.chen@code-byte.io",
  "david.miller@code-byte.io",
  "emma.watson@code-byte.io",
]);

export default function App() {
  // Authentication State
  const [user, setUser] = useState<{ email: string; name: string } | null>(() => {
    const saved = localStorage.getItem("codebyte_auth_user");
    return saved ? JSON.parse(saved) : null;
  });

  // Navigation & View State
  const [currentView, setCurrentView] = useState<ViewType>("leave-requests");
  
  // Data States
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [assets, setAssets] = useState<CompanyAsset[]>([]);
  const [assetAssignments, setAssetAssignments] = useState<AssetAssignment[]>([]);
  const [assetLogs, setAssetLogs] = useState<AssetActivityLog[]>([]);
  const prevLeaveRequestsRef = useRef<LeaveRequest[]>([]);
  const isFirstLeaveLoadRef = useRef<boolean>(true);
  
  const [loadingLeaves, setLoadingLeaves] = useState<boolean>(true);
  const [loadingAssets, setLoadingAssets] = useState<boolean>(true);
  
  // Connection Status (Firestore Live vs. LocalStorage Fallback)
  const [isLive, setIsLive] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Toast Notifications State
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "success" | "error" | "warning" | "info" }>>([]);

  const showToast = (message: string, type: "success" | "error" | "warning" | "info" = "success") => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Theme preference
  const [themeMode, setThemeMode] = useState<"auto" | "light" | "dark">(() => {
    try {
      const savedThemeMode = localStorage.getItem("theme_mode");
      if (savedThemeMode === "auto" || savedThemeMode === "light" || savedThemeMode === "dark") {
        return savedThemeMode;
      }
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "dark") return "dark";
      if (savedTheme === "light") return "light";
      return "auto";
    } catch {
      return "auto";
    }
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    const handleThemeChange = () => {
      let isDark = false;
      if (themeMode === "auto") {
        isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      } else {
        isDark = themeMode === "dark";
      }
      setIsDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    handleThemeChange();
    try {
      localStorage.setItem("theme_mode", themeMode);
    } catch (e) {
      console.error(e);
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", handleThemeChange);
    return () => mediaQuery.removeEventListener("change", handleThemeChange);
  }, [themeMode]);

  // Mobile drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Notifications State
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [isNotificationFromSidebar, setIsNotificationFromSidebar] = useState<boolean>(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("codebyte_read_notifications");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Admin Emails
  const ADMIN_EMAILS = [
    "htooaung.lin@code-byte.io",
    "ju.zaw@code-byte.io",
    "samson@code-byte.io",
    "yehtet.zaw@code-byte.io",
    ...admins.map(a => a.email.toLowerCase().trim())
  ];

  const currentUserEmail = user?.email?.toLowerCase().trim() || "";
  const isAdmin = ADMIN_EMAILS.some(e => e.toLowerCase().trim() === currentUserEmail);

  // Subscribe to Admins list
  const loadOfflineAdminsInApp = () => {
    try {
      const stored = localStorage.getItem("codebyte_fallback_admins");
      if (stored) {
        setAdmins(JSON.parse(stored));
      } else {
        const defaultAdmins: AdminUser[] = [
          { id: "admin-1", email: "htooaung.lin@code-byte.io" },
          { id: "admin-2", email: "ju.zaw@code-byte.io" },
          { id: "admin-3", email: "samson@code-byte.io" },
          { id: "admin-4", email: "yehtet.zaw@code-byte.io" }
        ];
        localStorage.setItem("codebyte_fallback_admins", JSON.stringify(defaultAdmins));
        setAdmins(defaultAdmins);
      }
    } catch (e) {
      console.error("Error reading offline admins:", e);
    }
  };

  useEffect(() => {
    let unsubscribe = () => {};
    let timeoutId: any;

    if (isLive && db) {
      timeoutId = setTimeout(() => {
        loadOfflineAdminsInApp();
      }, 2500);

      unsubscribe = adminService.subscribeAdmins(
        async (fetchedAdmins) => {
          clearTimeout(timeoutId);
          setAdmins(fetchedAdmins);
          try {
            localStorage.setItem("codebyte_fallback_admins", JSON.stringify(fetchedAdmins));
          } catch (e) {
            console.error(e);
          }

          if (fetchedAdmins.length === 0) {
            const defaultEmails = [
              "htooaung.lin@code-byte.io",
              "ju.zaw@code-byte.io",
              "samson@code-byte.io",
              "yehtet.zaw@code-byte.io"
            ];
            for (const email of defaultEmails) {
              try {
                await adminService.addAdmin(email);
              } catch (e) {
                console.error("Error seeding administrator:", e);
              }
            }
          }
        },
        (err) => {
          clearTimeout(timeoutId);
          console.warn("Admins subscription failed. Falling back to local storage:", err);
          loadOfflineAdminsInApp();
        }
      );
    } else {
      loadOfflineAdminsInApp();
    }

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [isLive]);

  // Subscribe to Team Members (never auto-seed random fake names)
  const loadOfflineTeam = () => {
    try {
      const stored = localStorage.getItem("codebyte_fallback_team");
      if (stored) {
        const parsed: TeamMember[] = JSON.parse(stored);
        const cleaned = parsed.filter(
          (m) => !FAKE_DEMO_EMAILS.has((m.email || "").toLowerCase().trim())
        );
        setTeamMembers(cleaned);
        localStorage.setItem("codebyte_fallback_team", JSON.stringify(cleaned));
      } else {
        setTeamMembers([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let unsubscribe = () => {};
    let timeoutId: any;
    
    if (db) {
      timeoutId = setTimeout(() => {
        setIsLive(false);
        loadOfflineTeam();
      }, 2500);

      unsubscribe = teamService.subscribeTeam(
        async (fetchedTeam) => {
          clearTimeout(timeoutId);
          const cleanedTeam = fetchedTeam.filter(
            (m) => !FAKE_DEMO_EMAILS.has((m.email || "").toLowerCase().trim())
          );
          setTeamMembers(cleanedTeam);
          setIsLive(true);
          setDbError(null);
          try {
            localStorage.setItem("codebyte_fallback_team", JSON.stringify(cleanedTeam));
          } catch (e) {
            console.error(e);
          }
        },
        (error) => {
          clearTimeout(timeoutId);
          setDbError(error.message || "Failed to sync team database.");
          setIsLive(false);
          loadOfflineTeam();
        }
      );
    } else {
      setIsLive(false);
      loadOfflineTeam();
    }

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  // Subscribe to Leave Requests (without fake sample leaves)
  useEffect(() => {
    let unsubscribe = () => {};
    let timeoutId: any;

    const loadOfflineLeavesInApp = () => {
      try {
        const stored = localStorage.getItem("codebyte_fallback_leave_requests");
        if (stored) {
          const parsed: LeaveRequest[] = JSON.parse(stored);
          const cleaned = parsed.filter(
            (r) =>
              r.id !== "lr-sample-1" &&
              !FAKE_DEMO_EMAILS.has((r.requestorEmail || "").toLowerCase().trim())
          );
          setLeaveRequests(cleaned);
        } else {
          setLeaveRequests([]);
        }
      } catch (e) {
        console.error("Error reading offline leaves:", e);
      }
      setLoadingLeaves(false);
    };

    if (isLive && db) {
      setLoadingLeaves(true);
      timeoutId = setTimeout(() => {
        loadOfflineLeavesInApp();
      }, 2500);

      unsubscribe = leaveService.subscribeLeaveRequests(
        (fetchedRequests) => {
          clearTimeout(timeoutId);

          if (!isFirstLeaveLoadRef.current && prevLeaveRequestsRef.current.length > 0) {
            const prevIds = new Set(prevLeaveRequestsRef.current.map(r => r.id));
            const newRequests = fetchedRequests.filter(r => !prevIds.has(r.id));

            newRequests.forEach(newReq => {
              const reqEmail = newReq.requestorEmail?.toLowerCase().trim();
              const myEmail = user?.email?.toLowerCase().trim();
              if (reqEmail !== myEmail) {
                const daysCount = getDaysDifference(newReq.startDate, newReq.endDate);
                const isHalfDay = newReq.dayType === "AM" || newReq.dayType === "PM";
                const totalWeight = isHalfDay ? 0.5 : daysCount;
                const daysText = `${totalWeight} working ${totalWeight === 1 ? "day" : "days"}`;
                const dateRangeText = newReq.startDate === newReq.endDate
                  ? `on ${formatWithDayOfWeek(newReq.startDate)}`
                  : `from ${formatWithDayOfWeek(newReq.startDate)} to ${formatWithDayOfWeek(newReq.endDate)}`;

                showToast(
                  `🔔 New Leave Submitted: ${newReq.requestorName} requested ${newReq.leaveType} (${daysText}) ${dateRangeText}.`,
                  "warning"
                );
              }
            });
          }

          isFirstLeaveLoadRef.current = false;
          prevLeaveRequestsRef.current = fetchedRequests;
          setLeaveRequests(fetchedRequests);
          setLoadingLeaves(false);
          try {
            localStorage.setItem("codebyte_fallback_leave_requests", JSON.stringify(fetchedRequests));
          } catch (e) {
            console.error(e);
          }
        },
        (err) => {
          clearTimeout(timeoutId);
          console.warn("Leave requests subscription failed. Falling back to local storage:", err);
          loadOfflineLeavesInApp();
        }
      );
    } else {
      loadOfflineLeavesInApp();
    }

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [isLive, user?.email]);

  // Subscribe to Company Assets, Assignments & Audit Logs
  useEffect(() => {
    if (!user?.email) {
      setAssets([]);
      setAssetAssignments([]);
      setAssetLogs([]);
      setLoadingAssets(false);
      return;
    }

    if (!db) {
      setLoadingAssets(false);
      return;
    }

    setLoadingAssets(true);

    const unsubAssets = assetService.subscribeAssets(
      isAdmin,
      user.email,
      (fetchedAssets) => {
        setAssets(fetchedAssets);
        setLoadingAssets(false);
      },
      (err) => {
        console.warn("Assets subscription error:", err);
        setLoadingAssets(false);
      }
    );

    const unsubAssignments = assetService.subscribeAssignments(
      isAdmin,
      user.email,
      (fetchedAssignments) => {
        setAssetAssignments(fetchedAssignments);
      },
      (err) => {
        console.warn("Asset assignments subscription error:", err);
      }
    );

    const unsubLogs = assetService.subscribeAssetLogs(
      isAdmin,
      (fetchedLogs) => {
        setAssetLogs(fetchedLogs);
      },
      (err) => {
        console.warn("Asset logs subscription error:", err);
      }
    );

    return () => {
      unsubAssets();
      unsubAssignments();
      unsubLogs();
    };
  }, [isAdmin, user?.email]);

  // Auth actions
  const handleLoginSuccess = (email: string, name: string) => {
    const u = { email, name };
    setUser(u);
    localStorage.setItem("codebyte_auth_user", JSON.stringify(u));
  };

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.error("Auth signOut error:", err);
      }
    }
    setUser(null);
    localStorage.removeItem("codebyte_auth_user");
    setCurrentView("leave-requests");
    setIsSidebarOpen(false);
  };

  // Team Management triggers
  const handleAddTeamMember = async (member: Omit<TeamMember, "id" | "createdAt">) => {
    if (isLive && db) {
      await teamService.addTeamMember(member);
    } else {
      const newM: TeamMember = {
        ...member,
        id: `local_team_${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      const updated = [...teamMembers, newM];
      setTeamMembers(updated);
      localStorage.setItem("codebyte_fallback_team", JSON.stringify(updated));
    }
    showToast(`Team member "${member.name}" added successfully.`, "success");
  };

  const handleUpdateTeamMember = async (id: string, updates: Partial<Omit<TeamMember, "id" | "createdAt">>) => {
    const existing = teamMembers.find((m) => m.id === id);
    if (isLive && db) {
      await teamService.updateTeamMember(id, updates);
      if (updates.status && existing) {
        await assetService.flagEmployeeAssetsDeactivated(
          id,
          updates.email || existing.email,
          updates.status === "Deactivated"
        );
      }
    } else {
      const updated = teamMembers.map((m) => (m.id === id ? { ...m, ...updates } : m));
      setTeamMembers(updated);
      localStorage.setItem("codebyte_fallback_team", JSON.stringify(updated));
    }
    showToast(`Team member updated successfully.`, "success");
  };

  const handleDeleteTeamMember = async (id: string) => {
    const existing = teamMembers.find((m) => m.id === id);
    if (isLive && db) {
      if (existing) {
        await assetService.flagEmployeeAssetsDeactivated(id, existing.email, true);
      }
      await teamService.deleteTeamMember(id);
    } else {
      const updated = teamMembers.filter((m) => m.id !== id);
      setTeamMembers(updated);
      localStorage.setItem("codebyte_fallback_team", JSON.stringify(updated));
    }
    showToast(`Team member removed.`, "success");
  };

  // Company Assets Handlers
  const handleCreateAsset = async (payload: Omit<CompanyAsset, "id" | "createdAt" | "updatedAt">) => {
    if (!user) return;
    await assetService.createAsset(payload, user);
    showToast(`Asset "${payload.assetCode}" created successfully.`, "success");
  };

  const handleUpdateAsset = async (
    assetId: string,
    updates: Partial<Omit<CompanyAsset, "id" | "createdAt">>
  ) => {
    if (!user) return;
    await assetService.updateAsset(assetId, updates, user);
    showToast(`Asset updated successfully.`, "success");
  };

  const handleAssignAsset = async (params: {
    assetId: string;
    employee: TeamMember;
    assignedDate: string;
    conditionAtHandover: AssetCondition;
    accessoriesHandedOver: string[];
    assignmentNotes?: string;
  }) => {
    if (!user) return;
    await assetService.assignAsset(params, user);
    showToast(`Asset assigned to ${params.employee.name}.`, "success");
  };

  const handleReturnAsset = async (params: {
    assetId: string;
    returnedDate: string;
    conditionAtReturn: AssetCondition;
    accessoriesReturned: string[];
    missingOrDamagedItems?: string;
    returnNotes?: string;
    postReturnStatus: "Available" | "Under Maintenance";
  }) => {
    if (!user) return;
    await assetService.returnAsset(params, user);
    showToast(`Asset return recorded (${params.postReturnStatus}).`, "success");
  };

  const handleReturnToSupplier = async (params: {
    assetId: string;
    returnedToSupplierDate: string;
    returnedToSupplierNotes?: string;
  }) => {
    if (!user) return;
    await assetService.returnToSupplier(params, user);
    showToast(`Rented asset marked as Returned to Supplier.`, "success");
  };

  const handleRetireAsset = async (assetId: string, reason: string) => {
    if (!user) return;
    await assetService.retireAsset(assetId, reason, user);
    showToast(`Asset retired from active inventory.`, "info");
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!user) return;
    await assetService.deleteAsset(assetId, user.email);
    showToast(`Asset permanently deleted.`, "success");
  };

  // Notifications Builder
  const getNotifications = () => {
    const list: Array<{
      id: string;
      type: "leave_pending" | "leave_resolved";
      title: string;
      description: string;
      dateStr?: string;
      linkView: ViewType;
      isRead: boolean;
    }> = [];

    // Leave Requests notifications
    leaveRequests.forEach(req => {
      const reqEmail = req.requestorEmail?.toLowerCase().trim();
      const isMyReq = reqEmail === currentUserEmail;

      const daysCount = getDaysDifference(req.startDate, req.endDate);
      const isHalfDay = req.dayType === "AM" || req.dayType === "PM";
      const totalWeight = isHalfDay ? 0.5 : daysCount;
      const daysText = `${totalWeight} working ${totalWeight === 1 ? "day" : "days"}`;
      const dateRangeText = req.startDate === req.endDate
        ? `on ${formatWithDayOfWeek(req.startDate)}`
        : `from ${formatWithDayOfWeek(req.startDate)} to ${formatWithDayOfWeek(req.endDate)}`;

      if (isAdmin && req.status === "Pending") {
        list.push({
          id: `leave-pending-${req.id}`,
          type: "leave_pending",
          title: "Leave Pending Approval",
          description: `${req.requestorName} requested ${req.leaveType} (${daysText}) ${dateRangeText}.`,
          linkView: "leave-requests",
          isRead: readNotificationIds.includes(`leave-pending-${req.id}`)
        });
      }

      if (isAdmin && !isMyReq && req.status === "Approved") {
        const portionText = isHalfDay ? ` (${req.dayType})` : "";
        list.push({
          id: `leave-approved-${req.id}`,
          type: "leave_resolved",
          title: "New Leave Logged",
          description: `${req.requestorName} logged ${req.leaveType}${portionText} (${daysText}) ${dateRangeText}.`,
          linkView: "leave-requests",
          isRead: readNotificationIds.includes(`leave-approved-${req.id}`)
        });
      }
    });

    // Leave Limits Notifications
    const currentYr = new Date().getFullYear().toString();
    const myApprovedLeavesInYear = leaveRequests.filter(req => 
      req.requestorEmail?.toLowerCase().trim() === currentUserEmail && 
      req.status === "Approved" &&
      (req.startDate ? req.startDate.substring(0, 4) === currentYr : true)
    );

    const calcWeight = (reqList: typeof leaveRequests, typeCheck: (t: string) => boolean) => {
      return reqList.reduce((sum, r) => {
        if (!typeCheck(r.leaveType)) return sum;
        const daysCount = getDaysDifference(r.startDate, r.endDate);
        const isHalfDay = r.dayType === "AM" || r.dayType === "PM";
        return sum + (daysCount * (isHalfDay ? 0.5 : 1.0));
      }, 0);
    };

    const myAnnualUsed = calcWeight(myApprovedLeavesInYear, t => t === "Annual Leave");
    const myCasualUsed = calcWeight(myApprovedLeavesInYear, t => t === "Casual Leave" || t === "Urgent Leave");
    const myMedicalUsed = calcWeight(myApprovedLeavesInYear, t => t === "Medical Leave");

    if (myCasualUsed >= 5) {
      list.push({
        id: `leave-warning-self-casual-${currentUserEmail}-${myCasualUsed}`,
        type: "leave_resolved",
        title: "Casual Leave Balance Alert",
        description: `You have logged ${myCasualUsed} of your 6.0 annual Casual Leave days.${myCasualUsed >= 6 ? " Casual leave limit reached!" : " You are close to your limit."}`,
        linkView: "leave-requests",
        isRead: readNotificationIds.includes(`leave-warning-self-casual-${currentUserEmail}-${myCasualUsed}`)
      });
    }

    if (myAnnualUsed >= 8) {
      list.push({
        id: `leave-warning-self-annual-${currentUserEmail}-${myAnnualUsed}`,
        type: "leave_resolved",
        title: "Annual Leave Balance Alert",
        description: `You have logged ${myAnnualUsed} of your 10.0 annual Annual Leave days.${myAnnualUsed >= 10 ? " Annual leave limit reached!" : " You are close to your limit."}`,
        linkView: "leave-requests",
        isRead: readNotificationIds.includes(`leave-warning-self-annual-${currentUserEmail}-${myAnnualUsed}`)
      });
    }

    if (myMedicalUsed >= 20) {
      list.push({
        id: `leave-warning-self-medical-${currentUserEmail}-${myMedicalUsed}`,
        type: "leave_resolved",
        title: "Medical Leave Balance Alert",
        description: `You have logged ${myMedicalUsed} of your 24.0 annual Medical Leave days.`,
        linkView: "leave-requests",
        isRead: readNotificationIds.includes(`leave-warning-self-medical-${currentUserEmail}-${myMedicalUsed}`)
      });
    }

    // Admin alerts for employees approaching balance caps
    if (isAdmin) {
      const approvedByEmail: Record<string, { name: string; annual: number; casual: number; medical: number }> = {};
      leaveRequests.forEach(req => {
        if (req.status !== "Approved") return;
        if (req.startDate && req.startDate.substring(0, 4) !== currentYr) return;
        const email = req.requestorEmail?.toLowerCase().trim();
        if (!email) return;
        const daysCount = getDaysDifference(req.startDate, req.endDate);
        const weight = daysCount * ((req.dayType === "AM" || req.dayType === "PM") ? 0.5 : 1.0);
        if (!approvedByEmail[email]) {
          approvedByEmail[email] = { name: req.requestorName, annual: 0, casual: 0, medical: 0 };
        }
        if (req.leaveType === "Annual Leave") approvedByEmail[email].annual += weight;
        else if (req.leaveType === "Casual Leave" || req.leaveType === "Urgent Leave") approvedByEmail[email].casual += weight;
        else if (req.leaveType === "Medical Leave") approvedByEmail[email].medical += weight;
      });

      Object.entries(approvedByEmail).forEach(([email, data]) => {
        if (email === currentUserEmail) return;
        if (data.casual >= 5) {
          list.push({
            id: `leave-warning-admin-casual-${email}-${data.casual}`,
            type: "leave_resolved",
            title: "Employee Casual Leave Alert",
            description: `${data.name} (${email}) has logged ${data.casual} of 6.0 Casual Leave days.`,
            linkView: "leave-requests",
            isRead: readNotificationIds.includes(`leave-warning-admin-casual-${email}-${data.casual}`)
          });
        }
        if (data.annual >= 8) {
          list.push({
            id: `leave-warning-admin-annual-${email}-${data.annual}`,
            type: "leave_resolved",
            title: "Employee Annual Leave Alert",
            description: `${data.name} (${email}) has logged ${data.annual} of 10.0 Annual Leave days.`,
            linkView: "leave-requests",
            isRead: readNotificationIds.includes(`leave-warning-admin-annual-${email}-${data.annual}`)
          });
        }
      });
    }

    return list;
  };

  const markNotificationAsRead = (id: string) => {
    setReadNotificationIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem("codebyte_read_notifications", JSON.stringify(next));
      return next;
    });
  };

  const clearAllNotifications = () => {
    const activeIds = getNotifications().map(n => n.id);
    setReadNotificationIds(prev => {
      const combined = Array.from(new Set([...prev, ...activeIds]));
      localStorage.setItem("codebyte_read_notifications", JSON.stringify(combined));
      return combined;
    });
  };

  const renderNotificationBell = (isSidebar = false) => {
    const notifications = getNotifications();
    const unread = notifications.filter(n => !n.isRead);
    const unreadCount = unread.length;

    return (
      <div className="relative">
        <button
          onClick={() => {
            setIsNotificationOpen(!isNotificationOpen);
            setIsNotificationFromSidebar(isSidebar);
          }}
          className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition focus:outline-none cursor-pointer"
          title="Notifications & Absence Radar"
        >
          <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    );
  };

  const renderNotificationDropdown = () => {
    if (!isNotificationOpen) return null;

    const notifications = getNotifications();
    const unread = notifications.filter(n => !n.isRead);
    const unreadCount = unread.length;

    return (
      <>
        {/* Click outside backdrop */}
        <div 
          className="fixed inset-0 z-50 cursor-default" 
          onClick={() => setIsNotificationOpen(false)} 
        />
        
        {/* Notification Dropdown Panel */}
        <div className={`
          fixed z-50 bg-white dark:bg-[#0f111a] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden animate-fade-in max-h-[480px] flex flex-col
          ${isNotificationFromSidebar 
            ? "left-4 md:left-[272px] top-20 md:top-[120px] w-[calc(100vw-32px)] sm:w-96" 
            : "right-4 top-16 w-[calc(100vw-32px)] sm:w-96"
          }
        `}>
          <div className="px-4.5 py-3 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#141624]">
            <div className="flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-slate-800 dark:text-slate-200" />
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Leave Radar & Alerts</span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 font-extrabold px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button 
                onClick={() => clearAllNotifications()}
                className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold hover:underline transition cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-[400px]">
            {/* Real-time Absence Radar */}
            {(() => {
              const now = new Date();
              const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const dayOfWeek = now.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const isFridayOrWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;

              let daysToAdd = 1;
              if (dayOfWeek === 5) daysToAdd = 3;
              else if (dayOfWeek === 6) daysToAdd = 2;

              const targetDate = new Date(now);
              targetDate.setDate(targetDate.getDate() + daysToAdd);
              const tomorrowOrMondayStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

              const leavesToday = isWeekend ? [] : leaveRequests.filter(req => {
                if (req.status !== "Approved") return false;
                const end = req.endDate || req.startDate;
                return req.startDate <= todayStr && end >= todayStr;
              });

              const leavesTomorrowOrMonday = leaveRequests.filter(req => {
                if (req.status !== "Approved") return false;
                const end = req.endDate || req.startDate;
                return req.startDate <= tomorrowOrMondayStr && end >= tomorrowOrMondayStr;
              });

              return (
                <div className="bg-slate-50/80 dark:bg-[#151828] border-b border-slate-150/70 dark:border-white/5 p-3.5 space-y-3">
                  {/* Today */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-100/50 dark:border-white/5">
                      <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                        Not in Office Today
                        <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 normal-case bg-slate-100/80 dark:bg-slate-800/85 px-1.5 py-0.5 rounded-md font-mono">
                          {formatDateWithDayOfWeek(todayStr)}
                        </span>
                      </span>
                      <span className="text-[9px] font-bold text-indigo-750 bg-indigo-50/70 dark:text-indigo-300 dark:bg-indigo-950/35 px-2.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/40">
                        {isWeekend ? "0" : leavesToday.length} absent
                      </span>
                    </div>

                    {isWeekend ? (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 italic py-1.5 text-center font-medium bg-amber-50/30 dark:bg-amber-950/10 rounded-lg border border-amber-100/50 dark:border-amber-900/20">
                        ☀️ Weekend! Office is closed today.
                      </div>
                    ) : leavesToday.length === 0 ? (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 italic py-1 text-center font-medium">
                        Everyone is present and in the office today! 🌟
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto pr-0.5">
                        {leavesToday.map(req => (
                          <div key={req.id} className="flex items-center gap-2 text-xs bg-white dark:bg-[#121420] border border-slate-200/50 dark:border-white/5 p-1.5 rounded-lg shadow-2xs">
                            <div className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-[#1d2133] flex items-center justify-center text-[9px] font-bold text-indigo-700 dark:text-indigo-400 shrink-0 uppercase">
                              {req.requestorName.substring(0, 2)}
                            </div>
                            <div className="min-w-0 flex-1 flex items-center justify-between">
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate pr-2">{req.requestorName}</span>
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-indigo-50/80 text-indigo-750 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
                                {req.leaveType}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tomorrow / Monday */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-100/50 dark:border-white/5">
                      <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        {isFridayOrWeekend ? "Not in Office Monday" : "Not in Office Tomorrow"}
                        <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 normal-case bg-slate-100/80 dark:bg-slate-800/85 px-1.5 py-0.5 rounded-md font-mono">
                          {formatDateWithDayOfWeek(tomorrowOrMondayStr)}
                        </span>
                      </span>
                      <span className="text-[9px] font-bold text-indigo-750 bg-indigo-50/70 dark:text-indigo-300 dark:bg-indigo-950/35 px-2.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/40">
                        {leavesTomorrowOrMonday.length} absent
                      </span>
                    </div>

                    {leavesTomorrowOrMonday.length === 0 ? (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 italic py-1 text-center font-medium">
                        Everyone is scheduled to be present {isFridayOrWeekend ? "on Monday" : "tomorrow"}! ✨
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto pr-0.5">
                        {leavesTomorrowOrMonday.map(req => (
                          <div key={req.id} className="flex items-center gap-2 text-xs bg-white dark:bg-[#121420] border border-slate-200/50 dark:border-white/5 p-1.5 rounded-lg shadow-2xs">
                            <div className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-[#1d2133] flex items-center justify-center text-[9px] font-bold text-indigo-700 dark:text-indigo-400 shrink-0 uppercase">
                              {req.requestorName.substring(0, 2)}
                            </div>
                            <div className="min-w-0 flex-1 flex items-center justify-between">
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate pr-2">{req.requestorName}</span>
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-50/80 text-amber-750 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
                                {req.leaveType}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs italic flex flex-col items-center justify-center gap-2 bg-white dark:bg-[#0f111a]">
                <CheckCircle2 className="w-8 h-8 text-slate-300" />
                <span>All caught up! No active leave alerts.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-[#0f111a]">
                {notifications.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => {
                      markNotificationAsRead(n.id);
                      setIsNotificationOpen(false);
                      setCurrentView(n.linkView);
                      setIsSidebarOpen(false);
                    }}
                    className={`p-4 text-left transition cursor-pointer flex gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-900/40 ${!n.isRead ? "bg-indigo-50/35 dark:bg-indigo-950/10 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20" : "bg-white dark:bg-[#0f111a]"}`}
                  >
                    <div className="mt-0.5">
                      {n.type === "leave_pending" ? (
                        <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-lg animate-pulse">
                          <Clock className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${!n.isRead ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>
                          {n.title}
                        </span>
                        {!n.isRead && (
                          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug break-words">
                        {n.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  // If unauthenticated, show Login
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} isLive={isLive} dbError={dbError} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0a0b10] flex text-slate-900 dark:text-slate-100 font-sans antialiased">
      {/* Root-level Notification Dropdown */}
      {renderNotificationDropdown()}

      {/* MOBILE TOP HEADER BAR */}
      <div className="md:hidden fixed top-0 inset-x-0 h-16 bg-white dark:bg-[#0d0f17] border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 z-40 shadow-xs">
        <div className="flex items-center gap-2">
          <Logo className="h-7" />
          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50">
            Leave Portal
          </span>
        </div>
        <div className="flex items-center gap-2">
          {renderNotificationBell()}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800 rounded-xl transition cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* MOBILE BACKDROP OVERLAY */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden animate-fade-in"
        />
      )}

      {/* LEFT NAVIGATION PERSISTENT SIDEBAR & MOBILE DRAWER */}
      <aside 
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white dark:bg-[#0d0f17] border-r border-slate-200/80 dark:border-white/10 p-5 flex flex-col justify-between shrink-0 z-50 transition-transform duration-300 md:translate-x-0 overflow-y-auto ${
          isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="space-y-6">
          {/* Logo container */}
          <div className="pb-3 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div>
              <Logo className="h-8" />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
                Leave Request Portal
              </p>
            </div>
            {/* Close button inside mobile drawer */}
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Connection Status and Notification Bell */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-[#141624] border border-slate-150/60 dark:border-white/5 rounded-2xl">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {isLive ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse shrink-0" />
                  <span className="text-slate-700 dark:text-slate-200 font-extrabold">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="text-slate-400 dark:text-slate-500 font-extrabold">Offline</span>
                </>
              )}
            </div>
            
            {renderNotificationBell(true)}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {/* 1. Leave Requests */}
            <button
              onClick={() => {
                setCurrentView("leave-requests");
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                currentView === "leave-requests" 
                  ? "bg-slate-900 text-white dark:bg-indigo-600 dark:text-white shadow-xs font-bold" 
                  : "text-slate-650 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-4.5 h-4.5" />
                <span>Leave Requests</span>
              </div>
              {isAdmin && leaveRequests.filter(r => r.status === "Pending").length > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-mono font-black px-2 py-0.5 rounded-full animate-pulse shadow-2xs">
                  {leaveRequests.filter(r => r.status === "Pending").length} Pending
                </span>
              )}
            </button>

            {/* 2. Team Management */}
            <button
              onClick={() => {
                setCurrentView("team-management");
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                currentView === "team-management" 
                  ? "bg-slate-900 text-white dark:bg-indigo-600 dark:text-white shadow-xs font-bold" 
                  : "text-slate-650 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              <Users className="w-4.5 h-4.5" />
              <span>Team Management</span>
            </button>

            {/* 3. Company Assets */}
            <button
              onClick={() => {
                setCurrentView("company-assets");
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                currentView === "company-assets" 
                  ? "bg-slate-900 text-white dark:bg-indigo-600 dark:text-white shadow-xs font-bold" 
                  : "text-slate-650 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <Laptop className="w-4.5 h-4.5" />
                <span>Company Assets</span>
              </div>
              {(() => {
                const alertCount = assets.filter((a) => {
                  const info = getRentalAlertInfo(a);
                  return (
                    info.level === "overdue" ||
                    info.level === "due-today" ||
                    info.level === "due-soon"
                  );
                }).length;
                if (isAdmin && alertCount > 0) {
                  return (
                    <span className="bg-amber-500 text-white text-[10px] font-mono font-black px-2 py-0.5 rounded-full shadow-2xs">
                      {alertCount} Due
                    </span>
                  );
                }
                return null;
              })()}
            </button>

            {/* 4. Settings */}
            <button
              onClick={() => {
                setCurrentView("settings");
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                currentView === "settings" 
                  ? "bg-slate-900 text-white dark:bg-indigo-600 dark:text-white shadow-xs font-bold" 
                  : "text-slate-650 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              <SettingsIcon className="w-4.5 h-4.5" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* PROFILE CARD & LOGOUT */}
        <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex flex-col gap-3">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-9 h-9 rounded-full bg-slate-900 dark:bg-indigo-600 text-white font-bold flex items-center justify-center tracking-wide text-xs shrink-0">
              {user.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-950 dark:text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05, rotate: isDarkMode ? 15 : -15 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (themeMode === "dark") {
                  setThemeMode("light");
                } else if (themeMode === "light") {
                  setThemeMode("dark");
                } else {
                  setThemeMode(isDarkMode ? "light" : "dark");
                }
              }}
              title={`Theme: ${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)} (Click to toggle)`}
              className="flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white aspect-square shrink-0 overflow-hidden relative cursor-pointer"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={isDarkMode ? "dark" : "light"}
                  initial={{ y: -16, opacity: 0, rotate: -45 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: 16, opacity: 0, rotate: 45 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="flex items-center justify-center"
                >
                  {isDarkMode ? (
                    <Sun className="w-4 h-4 text-amber-500 animate-pulse" />
                  ) : (
                    <Moon className="w-4 h-4 text-slate-600" />
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN WINDOW */}
      <div className="flex-1 flex flex-col min-w-0 md:pt-0 pt-16">
        {currentView === "leave-requests" && (
          <LeaveRequests 
            user={user}
            teamMembers={teamMembers}
            isLive={isLive}
            leaveRequests={leaveRequests}
            loadingLeaves={loadingLeaves}
            adminEmails={ADMIN_EMAILS}
          />
        )}

        {currentView === "company-assets" && (
          <CompanyAssets
            user={user}
            isAdmin={isAdmin}
            isLive={isLive}
            assets={assets}
            assignments={assetAssignments}
            assetLogs={assetLogs}
            teamMembers={teamMembers}
            loadingAssets={loadingAssets}
            onCreateAsset={handleCreateAsset}
            onUpdateAsset={handleUpdateAsset}
            onAssignAsset={handleAssignAsset}
            onReturnAsset={handleReturnAsset}
            onReturnToSupplier={handleReturnToSupplier}
            onRetireAsset={handleRetireAsset}
            onDeleteAsset={handleDeleteAsset}
          />
        )}

        {currentView === "team-management" && (
          <TeamManagement 
            user={user}
            members={teamMembers}
            assets={assets}
            assignments={assetAssignments}
            onAddMember={handleAddTeamMember}
            onUpdateMember={handleUpdateTeamMember}
            onDeleteMember={handleDeleteTeamMember}
            onAssignAsset={handleAssignAsset}
            onReturnAsset={handleReturnAsset}
            isLive={isLive}
            isAdmin={isAdmin}
          />
        )}

        {currentView === "settings" && (
          <Settings 
            user={user}
            admins={admins}
            isLive={isLive}
            teamMembers={teamMembers}
            themeMode={themeMode}
            onThemeModeChange={setThemeMode}
            isAdmin={isAdmin}
          />
        )}
      </div>

      {/* Floating Toast Notifications */}
      <div className="fixed bottom-4 sm:bottom-5 right-4 sm:right-5 left-4 sm:left-auto z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, y: -10, transition: { duration: 0.2 } }}
              layout
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md transition-all w-full select-none ${
                toast.type === "success"
                  ? "bg-emerald-600 dark:bg-emerald-950 text-white border-emerald-500/30"
                  : toast.type === "error"
                  ? "bg-rose-600 dark:bg-rose-950 text-white border-rose-500/30"
                  : toast.type === "warning"
                  ? "bg-amber-500 dark:bg-amber-950 text-white border-amber-400/30"
                  : "bg-slate-900 dark:bg-slate-950 text-white border-slate-800"
              }`}
            >
              {toast.type === "success" && <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-100" />}
              {toast.type === "error" && <AlertTriangle className="w-5 h-5 shrink-0 text-rose-100" />}
              {toast.type === "warning" && <AlertTriangle className="w-5 h-5 shrink-0 text-amber-100" />}
              {toast.type === "info" && <Briefcase className="w-5 h-5 shrink-0 text-indigo-100" />}
              
              <div className="flex-1 text-xs font-semibold leading-relaxed">
                {toast.message}
              </div>
              
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="p-1 rounded-md hover:bg-white/10 text-white/80 hover:text-white transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

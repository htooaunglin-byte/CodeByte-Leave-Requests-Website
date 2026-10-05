import { useState, useMemo } from "react";
import {
  CompanyAsset,
  AssetAssignment,
  AssetActivityLog,
  AssetCategory,
  AssetOwnership,
  AssetStatus,
  AssetCondition,
  TeamMember,
  getTeamMemberRank,
  getRentalAlertInfo,
} from "../types";
import {
  Laptop,
  Monitor,
  Smartphone,
  Router,
  Package,
  Plus,
  Search,
  Filter,
  UserCheck,
  RotateCcw,
  Truck,
  Edit2,
  Trash2,
  Archive,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Clock,
  X,
  History,
  FileText,
  ShieldAlert,
  MapPin,
  Hash,
  Calendar,
} from "lucide-react";
import {
  AssetFormModal,
  AssignAssetModal,
  ReturnAssetModal,
  ReturnToSupplierModal,
  RetireOrDeleteModal,
} from "./AssetActionModals";

interface CompanyAssetsProps {
  user: { email: string; name: string };
  isAdmin: boolean;
  isLive: boolean;
  assets: CompanyAsset[];
  assignments: AssetAssignment[];
  assetLogs: AssetActivityLog[];
  teamMembers: TeamMember[];
  loadingAssets: boolean;
  onCreateAsset: (payload: Omit<CompanyAsset, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdateAsset: (assetId: string, updates: Partial<Omit<CompanyAsset, "id" | "createdAt">>) => Promise<void>;
  onAssignAsset: (params: {
    assetId: string;
    employee: TeamMember;
    assignedDate: string;
    conditionAtHandover: AssetCondition;
    accessoriesHandedOver: string[];
    assignmentNotes?: string;
  }) => Promise<void>;
  onReturnAsset: (params: {
    assetId: string;
    returnedDate: string;
    conditionAtReturn: AssetCondition;
    accessoriesReturned: string[];
    missingOrDamagedItems?: string;
    returnNotes?: string;
    postReturnStatus: "Available" | "Under Maintenance";
  }) => Promise<void>;
  onReturnToSupplier: (params: {
    assetId: string;
    returnedToSupplierDate: string;
    returnedToSupplierNotes?: string;
  }) => Promise<void>;
  onRetireAsset: (assetId: string, reason: string) => Promise<void>;
  onDeleteAsset: (assetId: string) => Promise<void>;
}

function getCategoryIcon(category: AssetCategory) {
  switch (category) {
    case "Laptop":
      return <Laptop className="w-4 h-4" />;
    case "Monitor":
      return <Monitor className="w-4 h-4" />;
    case "Phone":
      return <Smartphone className="w-4 h-4" />;
    case "Network Equipment":
      return <Router className="w-4 h-4" />;
    default:
      return <Package className="w-4 h-4" />;
  }
}

function formatTimestamp(ts: any): string {
  if (!ts) return "—";
  try {
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function CompanyAssets({
  user,
  isAdmin,
  assets,
  assignments,
  assetLogs,
  teamMembers,
  loadingAssets,
  onCreateAsset,
  onUpdateAsset,
  onAssignAsset,
  onReturnAsset,
  onReturnToSupplier,
  onRetireAsset,
  onDeleteAsset,
}: CompanyAssetsProps) {
  // Search and Filter States
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");

  // Selected Asset for Details Panel
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [detailsTab, setDetailsTab] = useState<"overview" | "history" | "logs">("overview");

  // Action Modals State
  const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CompanyAsset | null>(null);
  const [assignModalAsset, setAssignModalAsset] = useState<CompanyAsset | null>(null);
  const [returnModalAsset, setReturnModalAsset] = useState<CompanyAsset | null>(null);
  const [supplierModalAsset, setSupplierModalAsset] = useState<CompanyAsset | null>(null);
  const [retireOrDeleteTarget, setRetireOrDeleteTarget] = useState<{
    asset: CompanyAsset;
    mode: "retire" | "delete";
  } | null>(null);

  const currentUserEmail = user.email.toLowerCase().trim();

  // Enforce permission scope on visible assets
  const visibleAssets = useMemo(() => {
    if (isAdmin) return assets;
    return assets.filter(
      (a) =>
        a.status === "Assigned" &&
        (a.assignedEmployeeEmail || "").toLowerCase().trim() === currentUserEmail
    );
  }, [assets, isAdmin, currentUserEmail]);

  // Summary counts
  const summaryStats = useMemo(() => {
    const total = visibleAssets.length;
    const available = visibleAssets.filter((a) => a.status === "Available").length;
    const assigned = visibleAssets.filter((a) => a.status === "Assigned").length;
    const maintenance = visibleAssets.filter((a) => a.status === "Under Maintenance").length;
    return { total, available, assigned, maintenance };
  }, [visibleAssets]);

  // Rented assets needing attention (due within 30 days or overdue, excluding Returned to Supplier / Retired)
  const rentalAlerts = useMemo(() => {
    return visibleAssets.filter((a) => {
      const alert = getRentalAlertInfo(a);
      return alert.level === "overdue" || alert.level === "due-today" || alert.level === "due-soon";
    });
  }, [visibleAssets]);

  // Deactivated or removed employees still holding assets
  const deactivatedEmployeeAssets = useMemo(() => {
    if (!isAdmin) return [];
    const activeMemberIds = new Set(
      teamMembers.filter((m) => m.status !== "Deactivated").map((m) => m.id)
    );
    const activeMemberEmails = new Set(
      teamMembers
        .filter((m) => m.status !== "Deactivated")
        .map((m) => m.email.toLowerCase().trim())
    );

    return visibleAssets.filter((a) => {
      if (a.status !== "Assigned") return false;
      if (a.assignedEmployeeDeactivated) return true;
      const empId = a.assignedEmployeeId || "";
      const empEmail = (a.assignedEmployeeEmail || "").toLowerCase().trim();
      const idActive = empId && activeMemberIds.has(empId);
      const emailActive = empEmail && activeMemberEmails.has(empEmail);
      return !idActive && !emailActive;
    });
  }, [visibleAssets, teamMembers, isAdmin]);

  // Filtered assets for the table
  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleAssets.filter((asset) => {
      if (q) {
        const matchCode = (asset.assetCode || "").toLowerCase().includes(q);
        const matchName = (asset.assetName || "").toLowerCase().includes(q);
        const matchSerial = (asset.serialNumber || "").toLowerCase().includes(q);
        const matchBrand = (asset.brandModel || "").toLowerCase().includes(q);
        const matchEmpName = (asset.assignedEmployeeName || "").toLowerCase().includes(q);
        const matchEmpEmail = (asset.assignedEmployeeEmail || "").toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchSerial && !matchBrand && !matchEmpName && !matchEmpEmail) {
          return false;
        }
      }
      if (categoryFilter !== "all" && asset.category !== categoryFilter) return false;
      if (ownershipFilter !== "all" && asset.ownershipType !== ownershipFilter) return false;
      if (statusFilter !== "all" && asset.status !== statusFilter) return false;
      if (isAdmin && employeeFilter !== "all") {
        if (employeeFilter === "unassigned") {
          if (asset.status === "Assigned" || asset.assignedEmployeeId) return false;
        } else {
          const matchesId = asset.assignedEmployeeId === employeeFilter;
          const targetMember = teamMembers.find((m) => m.id === employeeFilter);
          const matchesEmail =
            targetMember &&
            (asset.assignedEmployeeEmail || "").toLowerCase().trim() ===
              targetMember.email.toLowerCase().trim();
          if (!matchesId && !matchesEmail) return false;
        }
      }
      return true;
    });
  }, [
    visibleAssets,
    search,
    categoryFilter,
    ownershipFilter,
    statusFilter,
    employeeFilter,
    isAdmin,
    teamMembers,
  ]);

  const sortedTeamMembers = useMemo(() => {
    return [...teamMembers].sort((a, b) => {
      const rA = getTeamMemberRank(a);
      const rB = getTeamMemberRank(b);
      if (rA !== rB) return rA - rB;
      return a.name.localeCompare(b.name);
    });
  }, [teamMembers]);

  const selectedAsset = useMemo(
    () => visibleAssets.find((a) => a.id === selectedAssetId) || null,
    [visibleAssets, selectedAssetId]
  );

  const selectedAssetAssignments = useMemo(() => {
    if (!selectedAsset) return [];
    return assignments.filter((asgn) => asgn.assetId === selectedAsset.id);
  }, [assignments, selectedAsset]);

  const selectedAssetLogs = useMemo(() => {
    if (!selectedAsset) return [];
    return assetLogs.filter((log) => log.assetId === selectedAsset.id);
  }, [assetLogs, selectedAsset]);

  const availableAssets = useMemo(
    () => visibleAssets.filter((a) => a.status === "Available"),
    [visibleAssets]
  );

  const handleSaveAssetForm = async (
    payload: Omit<CompanyAsset, "id" | "createdAt" | "updatedAt">,
    assetId?: string
  ) => {
    if (assetId) {
      await onUpdateAsset(assetId, payload);
    } else {
      await onCreateAsset(payload);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setOwnershipFilter("all");
    setStatusFilter("all");
    setEmployeeFilter("all");
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    categoryFilter !== "all" ||
    ownershipFilter !== "all" ||
    statusFilter !== "all" ||
    employeeFilter !== "all";

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 flex-1 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isAdmin ? "Company Assets" : "My Assigned Assets"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin
              ? "Track company-owned and rented hardware, active employee assignments, accessories, and return history."
              : "View equipment and accessories currently assigned to you."}
          </p>
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={() => {
              setEditingAsset(null);
              setIsAssetFormOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Asset
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold">
            <ShieldAlert className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Personal Equipment View (Admin access required to manage inventory)</span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isAdmin ? "Total Assets" : "Assigned to You"}
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-1">
              {summaryStats.total}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Available</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-1">
              {summaryStats.available}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Assigned</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono tabular-nums mt-1">
              {summaryStats.assigned}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Under Maintenance
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono tabular-nums mt-1">
              {summaryStats.maintenance}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Wrench className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Alert Banner: Rented Assets Due Within 30 Days or Overdue */}
      {rentalAlerts.length > 0 && (
        <div className="bg-amber-50/90 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 dark:text-amber-200 space-y-1">
              <p className="font-bold">
                Rental Return Attention ({rentalAlerts.length}{" "}
                {rentalAlerts.length === 1 ? "asset" : "assets"} due within 30 days or overdue)
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-amber-800 dark:text-amber-300">
                {rentalAlerts.map((a) => {
                  const info = getRentalAlertInfo(a);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAssetId(a.id);
                        setDetailsTab("overview");
                      }}
                      className="underline hover:text-amber-950 dark:hover:text-white font-semibold cursor-pointer"
                    >
                      {a.assetCode} ({a.assetName}: {info.label})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOwnershipFilter("Rented")}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer self-start sm:self-center"
          >
            Filter Rented Assets
          </button>
        </div>
      )}

      {/* Alert Banner: Deactivated / Former Employees Holding Assets */}
      {deactivatedEmployeeAssets.length > 0 && (
        <div className="bg-rose-50/90 dark:bg-rose-950/30 border border-rose-300/80 dark:border-rose-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-950 dark:text-rose-200 space-y-1">
              <p className="font-bold">
                Follow-Up Required: Deactivated or Former Employee Holding Assets (
                {deactivatedEmployeeAssets.length})
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-rose-800 dark:text-rose-300">
                {deactivatedEmployeeAssets.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSelectedAssetId(a.id);
                      setDetailsTab("overview");
                    }}
                    className="underline hover:text-rose-950 dark:hover:text-white font-semibold cursor-pointer"
                  >
                    {a.assetCode} — held by {a.assignedEmployeeName}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search by asset code, name, serial number, brand, or employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="Laptop">Laptop</option>
              <option value="Monitor">Monitor</option>
              <option value="Phone">Phone</option>
              <option value="Network Equipment">Network Equipment</option>
              <option value="Other">Other</option>
            </select>

            <select
              value={ownershipFilter}
              onChange={(e) => setOwnershipFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Ownership</option>
              <option value="Company-owned">Company-owned</option>
              <option value="Rented">Rented</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Assigned">Assigned</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Returned to Supplier">Returned to Supplier</option>
              <option value="Retired">Retired</option>
            </select>

            {isAdmin && (
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Employees</option>
                <option value="unassigned">Unassigned Only</option>
                {sortedTeamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing <strong className="font-mono">{filteredAssets.length}</strong> of{" "}
              <strong className="font-mono">{visibleAssets.length}</strong> assets
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Main Assets Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-5">Asset Code</th>
                <th className="py-3.5 px-5">Asset Name</th>
                <th className="py-3.5 px-5">Ownership Type</th>
                <th className="py-3.5 px-5">Assigned Employee</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Condition</th>
                <th className="py-3.5 px-5">Rental End Date</th>
                {isAdmin && <th className="py-3.5 px-5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
              {loadingAssets ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-5">
                      <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                    </td>
                    {isAdmin && <td className="py-4 px-5" />}
                  </tr>
                ))
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 8 : 7}
                    className="py-12 px-6 text-center text-slate-400 dark:text-slate-500"
                  >
                    <div className="max-w-sm mx-auto space-y-2">
                      <Package className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {hasActiveFilters
                          ? "No matching assets found"
                          : isAdmin
                          ? "No company assets registered yet"
                          : "No equipment currently assigned to you"}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {hasActiveFilters
                          ? "Try adjusting your search query or clearing the active filters."
                          : isAdmin
                          ? "Add your first laptop, monitor, phone, or rented device to begin tracking assignments."
                          : "When an administrator assigns company equipment to you, its details and accessories will appear here."}
                      </p>
                      {isAdmin && !hasActiveFilters && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAsset(null);
                            setIsAssetFormOpen(true);
                          }}
                          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add First Asset
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const rentalAlert = getRentalAlertInfo(asset);
                  const isFlaggedRental =
                    rentalAlert.level === "overdue" ||
                    rentalAlert.level === "due-today" ||
                    rentalAlert.level === "due-soon";
                  const isSelected = selectedAssetId === asset.id;

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => {
                        setSelectedAssetId(asset.id);
                        setDetailsTab("overview");
                      }}
                      className={`transition cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50/70 dark:bg-indigo-950/30"
                          : isFlaggedRental
                          ? "bg-amber-50/30 dark:bg-amber-950/15 hover:bg-amber-50/60 dark:hover:bg-amber-950/25"
                          : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      {/* Asset Code */}
                      <td className="py-3.5 px-5 align-middle whitespace-nowrap">
                        <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                          {asset.assetCode}
                        </span>
                      </td>

                      {/* Asset Name & Category */}
                      <td className="py-3.5 px-5 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                            {getCategoryIcon(asset.category)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[220px]">
                              {asset.assetName}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                              <span>{asset.category}</span>
                              {asset.brandModel && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate max-w-[140px]">{asset.brandModel}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Ownership Type */}
                      <td className="py-3.5 px-5 align-middle whitespace-nowrap text-xs">
                        <span
                          className={`font-medium ${
                            asset.ownershipType === "Rented"
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {asset.ownershipType}
                        </span>
                        {asset.ownershipType === "Rented" && asset.supplier && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[130px]">
                            {asset.supplier}
                          </div>
                        )}
                      </td>

                      {/* Assigned Employee */}
                      <td className="py-3.5 px-5 align-middle">
                        {asset.status === "Assigned" && asset.assignedEmployeeName ? (
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                              <span>{asset.assignedEmployeeName}</span>
                              {asset.assignedEmployeeDeactivated && (
                                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                  (Deactivated)
                                </span>
                              )}
                            </div>
                            {asset.assignedDate && (
                              <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                                Since {asset.assignedDate}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5 align-middle whitespace-nowrap text-xs font-semibold">
                        <span
                          className={
                            asset.status === "Available"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : asset.status === "Assigned"
                              ? "text-indigo-600 dark:text-indigo-400"
                              : asset.status === "Under Maintenance"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-slate-500 dark:text-slate-400"
                          }
                        >
                          {asset.status}
                        </span>
                      </td>

                      {/* Condition */}
                      <td className="py-3.5 px-5 align-middle whitespace-nowrap text-xs">
                        <span
                          className={`font-medium ${
                            asset.condition === "Good"
                              ? "text-slate-700 dark:text-slate-300"
                              : asset.condition === "Fair"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-rose-600 dark:text-rose-400 font-semibold"
                          }`}
                        >
                          {asset.condition}
                        </span>
                      </td>

                      {/* Rental End Date */}
                      <td className="py-3.5 px-5 align-middle whitespace-nowrap text-xs font-mono">
                        {asset.ownershipType === "Rented" ? (
                          asset.rentalEndDate ? (
                            <div className="space-y-0.5">
                              <div className="text-slate-800 dark:text-slate-200">
                                {asset.rentalEndDate}
                              </div>
                              {rentalAlert.level === "overdue" && (
                                <div className="text-[11px] font-sans font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {rentalAlert.label}
                                </div>
                              )}
                              {(rentalAlert.level === "due-today" ||
                                rentalAlert.level === "due-soon") && (
                                <div className="text-[11px] font-sans font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {rentalAlert.label}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 font-sans">
                              Not set
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>

                      {/* Quick Row Actions (Admin) */}
                      {isAdmin && (
                        <td
                          className="py-3.5 px-5 align-middle text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {asset.status === "Available" && (
                              <button
                                type="button"
                                onClick={() => setAssignModalAsset(asset)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 rounded-md text-xs font-semibold transition cursor-pointer"
                              >
                                Assign
                              </button>
                            )}
                            {asset.status === "Assigned" && (
                              <button
                                type="button"
                                onClick={() => setReturnModalAsset(asset)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 rounded-md text-xs font-semibold transition cursor-pointer"
                              >
                                Return
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAsset(asset);
                                setIsAssetFormOpen(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
                              title="Edit Asset"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================================
          ASSET DETAILS SLIDE-OVER PANEL
         ===================================================================== */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs z-50 flex justify-end animate-fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setSelectedAssetId(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-start justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedAsset.assetCode}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedAsset.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedAsset.ownershipType}</span>
                </div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5 truncate">
                  {selectedAsset.assetName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAssetId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Admin Action Bar inside Drawer */}
            {isAdmin && (
              <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-2 shrink-0">
                {selectedAsset.status === "Available" && (
                  <button
                    type="button"
                    onClick={() => setAssignModalAsset(selectedAsset)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Assign to Employee
                  </button>
                )}

                {selectedAsset.status === "Assigned" && (
                  <button
                    type="button"
                    onClick={() => setReturnModalAsset(selectedAsset)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Return from Employee
                  </button>
                )}

                {selectedAsset.ownershipType === "Rented" &&
                  selectedAsset.status !== "Assigned" &&
                  selectedAsset.status !== "Returned to Supplier" &&
                  selectedAsset.status !== "Retired" && (
                    <button
                      type="button"
                      onClick={() => setSupplierModalAsset(selectedAsset)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      Return to Supplier
                    </button>
                  )}

                <button
                  type="button"
                  onClick={() => {
                    setEditingAsset(selectedAsset);
                    setIsAssetFormOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>

                {selectedAsset.status !== "Assigned" && selectedAsset.status !== "Retired" && (
                  <button
                    type="button"
                    onClick={() =>
                      setRetireOrDeleteTarget({ asset: selectedAsset, mode: "retire" })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Retire
                  </button>
                )}

                {selectedAsset.status !== "Assigned" &&
                  !selectedAsset.hasAssignmentHistory &&
                  selectedAssetAssignments.length === 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setRetireOrDeleteTarget({ asset: selectedAsset, mode: "delete" })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-semibold cursor-pointer ml-auto"
                      title="Delete mistakenly created asset (no assignment history)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
              </div>
            )}

            {/* Drawer Navigation Tabs */}
            <div className="px-6 pt-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-6 text-xs font-bold bg-white dark:bg-slate-900 shrink-0">
              <button
                type="button"
                onClick={() => setDetailsTab("overview")}
                className={`pb-2.5 border-b-2 transition cursor-pointer ${
                  detailsTab === "overview"
                    ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Overview & Accessories
              </button>
              <button
                type="button"
                onClick={() => setDetailsTab("history")}
                className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  detailsTab === "history"
                    ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Assignment History ({selectedAssetAssignments.length})
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setDetailsTab("logs")}
                  className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                    detailsTab === "logs"
                      ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Audit Log ({selectedAssetLogs.length})
                </button>
              )}
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {detailsTab === "overview" && (
                <>
                  {/* Rental Alert Banner inside Details */}
                  {(() => {
                    const alert = getRentalAlertInfo(selectedAsset);
                    if (
                      alert.level === "overdue" ||
                      alert.level === "due-today" ||
                      alert.level === "due-soon"
                    ) {
                      return (
                        <div
                          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                            alert.level === "overdue"
                              ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                              : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                          }`}
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold">Rental Status: {alert.label}</div>
                            <div className="opacity-80 mt-0.5">
                              Rental end date is {selectedAsset.rentalEndDate}.
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Active Assignment Section */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Current Assignment
                    </h3>
                    {selectedAsset.status === "Assigned" && selectedAsset.assignedEmployeeName ? (
                      <div className="p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {selectedAsset.assignedEmployeeName}
                          </div>
                          <span className="text-xs font-mono text-indigo-700 dark:text-indigo-300">
                            Assigned {selectedAsset.assignedDate || "—"}
                          </span>
                        </div>
                        {selectedAsset.assignedEmployeeEmail &&
                          !selectedAsset.assignedEmployeeEmail.endsWith("@noemail.local") && (
                            <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                              {selectedAsset.assignedEmployeeEmail}
                            </div>
                          )}
                        {selectedAsset.assignedEmployeeDeactivated && (
                          <div className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 pt-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Employee is deactivated/removed — follow up to collect equipment.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400">
                        Not currently assigned to any employee (Status:{" "}
                        <strong className="text-slate-700 dark:text-slate-200">
                          {selectedAsset.status}
                        </strong>
                        ).
                      </div>
                    )}
                  </div>

                  {/* Core Specifications Grid */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Hardware Specifications
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                        <div className="text-slate-400 dark:text-slate-500">Brand / Model</div>
                        <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                          {selectedAsset.brandModel || "—"}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                        <div className="text-slate-400 dark:text-slate-500">Serial Number</div>
                        <div className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                          {selectedAsset.serialNumber || "—"}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                        <div className="text-slate-400 dark:text-slate-500">Condition</div>
                        <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                          {selectedAsset.condition}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                        <div className="text-slate-400 dark:text-slate-500">Location</div>
                        <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                          {selectedAsset.location || "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Included Accessories */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Included Accessories
                    </h3>
                    {selectedAsset.accessories && selectedAsset.accessories.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedAsset.accessories.map((acc) => (
                          <span
                            key={acc}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                          >
                            {acc}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                        No accessories listed.
                      </p>
                    )}
                  </div>

                  {/* Rented Equipment Details */}
                  {selectedAsset.ownershipType === "Rented" && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Rental Agreement Details
                      </h3>
                      <div className="p-4 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/50 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-slate-400 dark:text-slate-500">
                            Supplier / Rental Company
                          </div>
                          <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                            {selectedAsset.supplier || "Not specified"}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400 dark:text-slate-500">Rental Cost</div>
                          <div className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                            {selectedAsset.rentalCost !== null &&
                            selectedAsset.rentalCost !== undefined
                              ? `${selectedAsset.rentalCost.toLocaleString()} ${
                                  selectedAsset.rentalCurrency || ""
                                }${
                                  selectedAsset.rentalBillingPeriod
                                    ? ` / ${selectedAsset.rentalBillingPeriod}`
                                    : ""
                                }`
                              : "Not specified"}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400 dark:text-slate-500">Rental Start Date</div>
                          <div className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                            {selectedAsset.rentalStartDate || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400 dark:text-slate-500">Rental End Date</div>
                          <div className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                            {selectedAsset.rentalEndDate || "—"}
                          </div>
                        </div>
                        {selectedAsset.returnedToSupplierDate && (
                          <div className="col-span-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/40">
                            <span className="font-bold text-emerald-700 dark:text-emerald-300">
                              Returned to Supplier on {selectedAsset.returnedToSupplierDate}
                            </span>
                            {selectedAsset.returnedToSupplierNotes && (
                              <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                                {selectedAsset.returnedToSupplierNotes}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedAsset.notes && (
                    <div className="space-y-1.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Notes
                      </h3>
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line">
                        {selectedAsset.notes}
                      </div>
                    </div>
                  )}
                </>
              )}

              {detailsTab === "history" && (
                <div className="space-y-3">
                  {selectedAssetAssignments.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                      No assignment history recorded for this asset yet.
                    </div>
                  ) : (
                    selectedAssetAssignments.map((asgn) => (
                      <div
                        key={asgn.id}
                        className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {asgn.employeeName}
                          </div>
                          <span
                            className={`font-bold ${
                              asgn.status === "Active"
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {asgn.status === "Active" ? "Currently Assigned" : "Returned"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                          <div>
                            <span className="text-slate-400">Assigned Date:</span>{" "}
                            <span className="font-mono font-semibold">{asgn.assignedDate}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Handover Condition:</span>{" "}
                            <span className="font-semibold">{asgn.conditionAtHandover}</span>
                          </div>
                          {asgn.accessoriesHandedOver && asgn.accessoriesHandedOver.length > 0 && (
                            <div className="col-span-2">
                              <span className="text-slate-400">Accessories Handed Over:</span>{" "}
                              <span className="font-medium">
                                {asgn.accessoriesHandedOver.join(", ")}
                              </span>
                            </div>
                          )}
                          {asgn.assignmentNotes && (
                            <div className="col-span-2 text-slate-500 dark:text-slate-400">
                              Handover Note: {asgn.assignmentNotes}
                            </div>
                          )}
                        </div>

                        {asgn.status === "Returned" && (
                          <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                            <div>
                              <span className="text-slate-400">Returned Date:</span>{" "}
                              <span className="font-mono font-semibold">
                                {asgn.returnedDate || "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Return Condition:</span>{" "}
                              <span className="font-semibold">{asgn.conditionAtReturn || "—"}</span>
                            </div>
                            {asgn.accessoriesReturned && (
                              <div className="col-span-2">
                                <span className="text-slate-400">Accessories Returned:</span>{" "}
                                <span className="font-medium">
                                  {asgn.accessoriesReturned.length > 0
                                    ? asgn.accessoriesReturned.join(", ")
                                    : "None"}
                                </span>
                              </div>
                            )}
                            {asgn.missingOrDamagedItems && (
                              <div className="col-span-2 text-rose-600 dark:text-rose-400 font-semibold">
                                Missing / Damaged: {asgn.missingOrDamagedItems}
                              </div>
                            )}
                            {asgn.returnNotes && (
                              <div className="col-span-2 text-slate-500 dark:text-slate-400">
                                Return Note: {asgn.returnNotes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {detailsTab === "logs" && isAdmin && (
                <div className="space-y-3">
                  {selectedAssetLogs.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                      No activity logs recorded for this asset yet.
                    </div>
                  ) : (
                    selectedAssetLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            {log.action.replace(/_/g, " ")}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                            {formatTimestamp(log.createdAt)}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-200">{log.summary}</p>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                          By {log.actorName} ({log.actorEmail})
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shared Modals */}
      <AssetFormModal
        isOpen={isAssetFormOpen}
        onClose={() => {
          setIsAssetFormOpen(false);
          setEditingAsset(null);
        }}
        editingAsset={editingAsset}
        existingAssets={assets}
        onSave={handleSaveAssetForm}
      />

      <AssignAssetModal
        isOpen={!!assignModalAsset}
        onClose={() => setAssignModalAsset(null)}
        preselectedAsset={assignModalAsset}
        availableAssets={availableAssets}
        teamMembers={teamMembers}
        onAssign={onAssignAsset}
      />

      <ReturnAssetModal
        isOpen={!!returnModalAsset}
        onClose={() => setReturnModalAsset(null)}
        asset={returnModalAsset}
        activeAssignment={
          returnModalAsset
            ? assignments.find(
                (a) => a.assetId === returnModalAsset.id && a.status === "Active"
              ) || null
            : null
        }
        onReturn={onReturnAsset}
      />

      <ReturnToSupplierModal
        isOpen={!!supplierModalAsset}
        onClose={() => setSupplierModalAsset(null)}
        asset={supplierModalAsset}
        onConfirm={onReturnToSupplier}
      />

      <RetireOrDeleteModal
        isOpen={!!retireOrDeleteTarget}
        mode={retireOrDeleteTarget?.mode || "retire"}
        onClose={() => setRetireOrDeleteTarget(null)}
        asset={retireOrDeleteTarget?.asset || null}
        hasHistory={
          retireOrDeleteTarget
            ? assignments.some((a) => a.assetId === retireOrDeleteTarget.asset.id)
            : false
        }
        onRetire={onRetireAsset}
        onDelete={async (id) => {
          await onDeleteAsset(id);
          if (selectedAssetId === id) setSelectedAssetId(null);
        }}
      />
    </div>
  );
}

import { useState, FormEvent, Fragment, useMemo } from "react";
import {
  TeamMember,
  CompanyAsset,
  AssetAssignment,
  AssetCondition,
  getTeamMemberRank,
} from "../types";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  Check,
  ShieldAlert,
  AlertTriangle,
  Award,
  Laptop,
  Package,
  UserCheck,
  RotateCcw,
  UserX,
  History,
  ChevronRight,
} from "lucide-react";
import { motion } from "motion/react";
import { AssignAssetModal, ReturnAssetModal } from "./AssetActionModals";

interface TeamManagementProps {
  user: { email: string; name: string };
  members: TeamMember[];
  assets: CompanyAsset[];
  assignments: AssetAssignment[];
  onAddMember: (member: Omit<TeamMember, "id" | "createdAt">) => Promise<any>;
  onUpdateMember: (id: string, updates: Partial<Omit<TeamMember, "id" | "createdAt">>) => Promise<any>;
  onDeleteMember: (id: string) => Promise<any>;
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
  isLive: boolean;
  isAdmin?: boolean;
}

const getSeniorityStyle = (rank: number) => {
  switch (rank) {
    case 1:
      return {
        rowClass: "bg-amber-50/60 hover:bg-amber-100/60 border-l-4 border-l-amber-500 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:border-l-amber-400",
        badge: "bg-amber-100 text-amber-900 border-amber-300/90 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700/60",
        avatar: "bg-amber-100 text-amber-800 ring-2 ring-amber-400/60 font-bold dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-500/60",
        rankLabel: "#1 Executive Lead",
      };
    case 2:
      return {
        rowClass: "bg-indigo-50/50 hover:bg-indigo-100/50 border-l-4 border-l-indigo-500 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:border-l-indigo-400",
        badge: "bg-indigo-100 text-indigo-900 border-indigo-300/90 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-700/60",
        avatar: "bg-indigo-100 text-indigo-800 ring-2 ring-indigo-400/60 font-bold dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-500/60",
        rankLabel: "#2 Executive",
      };
    case 3:
      return {
        rowClass: "bg-sky-50/50 hover:bg-sky-100/50 border-l-4 border-l-sky-500 dark:bg-sky-500/10 dark:hover:bg-sky-500/20 dark:border-l-sky-400",
        badge: "bg-sky-100 text-sky-900 border-sky-300/90 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-700/60",
        avatar: "bg-sky-100 text-sky-800 ring-2 ring-sky-400/60 font-bold dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-500/60",
        rankLabel: "#3 Senior Leadership",
      };
    case 4:
      return {
        rowClass: "bg-teal-50/50 hover:bg-teal-100/50 border-l-4 border-l-teal-500 dark:bg-teal-500/10 dark:hover:bg-teal-500/20 dark:border-l-teal-400",
        badge: "bg-teal-100 text-teal-900 border-teal-300/90 dark:bg-teal-950/80 dark:text-teal-300 dark:border-teal-700/60",
        avatar: "bg-teal-100 text-teal-800 ring-2 ring-teal-400/60 font-bold dark:bg-teal-950 dark:text-teal-300 dark:ring-teal-500/60",
        rankLabel: "#4 Senior Leadership",
      };
    default:
      return null;
  }
};

const getRolePriority = (role: string): number => {
  const r = (role || "").toLowerCase();
  if (r.includes("ceo") || r.includes("chief executive")) return 1;
  if (r.includes("system integration") || r.includes("system integrator")) return 2;
  if (r.includes("senior") || r.includes("lead") || r.includes("principal")) return 3;
  // Project Engineer specifically placed below Sales and above Intern
  if (r.includes("project engineer") || r.includes("project engineering")) return 6;
  if (r.includes("sales") || r.includes("marketing") || r.includes("hr") || r.includes("recruiter")) return 5;
  if (r.includes("intern") || r.includes("trainee")) return 7;
  // Cybersecurity Engineer and other core engineers/PMs/designers
  if (
    r.includes("cybersecurity") ||
    r.includes("engineer") ||
    r.includes("developer") ||
    r.includes("architect") ||
    r.includes("designer") ||
    r.includes("manager") ||
    r.includes("pm") ||
    r.includes("analyst") ||
    r.includes("specialist") ||
    r.includes("scrum") ||
    r.includes("qa") ||
    r.includes("tester")
  ) return 4;
  return 8;
};

export default function TeamManagement({
  user,
  members,
  assets,
  assignments,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onAssignAsset,
  onReturnAsset,
  isAdmin = false
}: TeamManagementProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightSeniority, setHighlightSeniority] = useState(true);
  
  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [memberStatus, setMemberStatus] = useState<"Active" | "Deactivated">("Active");
  const [error, setError] = useState<string | null>(null);

  // Employee Profile Slide-Over Panel state
  const [selectedProfileMemberId, setSelectedProfileMemberId] = useState<string | null>(null);

  // Assign / Return Asset Modals from Employee Profile
  const [assignModalMember, setAssignModalMember] = useState<TeamMember | null>(null);
  const [returnModalAsset, setReturnModalAsset] = useState<CompanyAsset | null>(null);

  // Custom delete / deactivate confirmation state (iframe-safe)
  const [deleteConfirmMember, setDeleteConfirmMember] = useState<{ id: string; name: string } | null>(null);

  const currentUserEmail = (user?.email || "").toLowerCase().trim();

  // Helper to get active assets for a member
  const getMemberActiveAssets = (member: TeamMember): CompanyAsset[] => {
    const memberEmail = (member.email || "").toLowerCase().trim();
    return assets.filter((a) => {
      if (a.status !== "Assigned") return false;
      if (a.assignedEmployeeId && a.assignedEmployeeId === member.id) return true;
      if (
        memberEmail &&
        !memberEmail.endsWith("@noemail.local") &&
        (a.assignedEmployeeEmail || "").toLowerCase().trim() === memberEmail
      ) {
        return true;
      }
      return false;
    });
  };

  // Helper to get assignment records for a member
  const getMemberAssignments = (member: TeamMember): AssetAssignment[] => {
    const memberEmail = (member.email || "").toLowerCase().trim();
    return assignments.filter((asgn) => {
      if (asgn.employeeId && asgn.employeeId === member.id) return true;
      if (
        memberEmail &&
        !memberEmail.endsWith("@noemail.local") &&
        (asgn.employeeEmail || "").toLowerCase().trim() === memberEmail
      ) {
        return true;
      }
      return false;
    });
  };

  const canViewMemberAssets = (member: TeamMember): boolean => {
    if (isAdmin) return true;
    const memberEmail = (member.email || "").toLowerCase().trim();
    return !!memberEmail && memberEmail === currentUserEmail;
  };

  const availableAssets = useMemo(
    () => assets.filter((a) => a.status === "Available"),
    [assets]
  );

  const selectedProfileMember = useMemo(
    () => members.find((m) => m.id === selectedProfileMemberId) || null,
    [members, selectedProfileMemberId]
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isAdmin) {
      setError("Only administrators are authorized to add or edit team members.");
      return;
    }

    if (!name.trim() || !role.trim()) {
      setError("Please fill out Name and Role.");
      return;
    }

    // Auto-generate a unique placeholder email if not provided
    let finalEmail = email.trim().toLowerCase();
    if (!finalEmail) {
      if (isEditing && currentId) {
        const existingMember = members.find(m => m.id === currentId);
        finalEmail = existingMember?.email || `${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || "member"}-${Math.random().toString(36).substring(2, 6)}@noemail.local`;
      } else {
        finalEmail = `${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || "member"}-${Math.random().toString(36).substring(2, 6)}@noemail.local`;
      }
    }

    const payload: Omit<TeamMember, "id" | "createdAt"> = {
      name: name.trim(),
      email: finalEmail,
      role: role.trim(),
      status: memberStatus,
    };

    try {
      if (isEditing && currentId) {
        await onUpdateMember(currentId, payload);
      } else {
        // Check if email already exists in members (skip checking for auto-generated emails)
        if (payload.email && !payload.email.endsWith("@noemail.local")) {
          const emailExists = members.some(m => m.email.toLowerCase() === payload.email && m.id !== currentId);
          if (emailExists) {
            setError("A team member with this email address already exists.");
            return;
          }
        }
        await onAddMember(payload);
      }
      handleClose();
    } catch (err: any) {
      setError(err.message || "Operation failed. Please check connection.");
    }
  };

  const handleEdit = (member: TeamMember) => {
    if (!isAdmin) return;
    setName(member.name);
    // Hide the pseudo-email when editing
    setEmail(member.email.endsWith("@noemail.local") ? "" : member.email);
    setRole(member.role);
    setMemberStatus(member.status || "Active");
    setCurrentId(member.id);
    setIsEditing(true);
    setIsOpen(true);
  };

  const handleDeleteClick = (id: string, name: string) => {
    if (!isAdmin) return;
    setDeleteConfirmMember({ id, name });
  };

  const handleConfirmDeleteMember = async () => {
    if (!deleteConfirmMember || !isAdmin) return;
    try {
      await onDeleteMember(deleteConfirmMember.id);
      if (selectedProfileMemberId === deleteConfirmMember.id) {
        setSelectedProfileMemberId(null);
      }
      setDeleteConfirmMember(null);
    } catch (err: any) {
      setError(err.message || "Removal failed.");
    }
  };

  const handleToggleDeactivate = async (member: TeamMember) => {
    if (!isAdmin) return;
    const nextStatus = member.status === "Deactivated" ? "Active" : "Deactivated";
    await onUpdateMember(member.id, { status: nextStatus });
  };

  const handleClose = () => {
    setName("");
    setEmail("");
    setRole("");
    setMemberStatus("Active");
    setCurrentId(null);
    setIsEditing(false);
    setIsOpen(false);
    setError(null);
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  );

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    // 1. Executive hierarchy: Samson, Ju Zaw, Ye Htet Zaw, Carbon
    const rankA = getTeamMemberRank(a);
    const rankB = getTeamMemberRank(b);
    if (rankA !== rankB) return rankA - rankB;

    // 2. Role priority fallback
    const pA = getRolePriority(a.role);
    const pB = getRolePriority(b.role);
    if (pA !== pB) return pA - pB;
    const roleCompare = a.role.localeCompare(b.role);
    if (roleCompare !== 0) return roleCompare;
    return a.name.localeCompare(b.name);
  });

  // Deactivated members still holding assets warning
  const deactivatedMembersWithAssets = useMemo(() => {
    if (!isAdmin) return [];
    return members.filter(
      (m) => m.status === "Deactivated" && getMemberActiveAssets(m).length > 0
    );
  }, [members, assets, isAdmin]);

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 flex-1 max-w-7xl mx-auto w-full">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Team Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Maintain the whitelisted team roster and view or manage each employee&apos;s assigned company assets.
          </p>
        </div>
        {isAdmin ? (
          <button
            onClick={() => {
              setIsEditing(false);
              setMemberStatus("Active");
              setIsOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Member
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 rounded-xl text-xs font-bold shadow-2xs">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Read-Only Roster (Click your own profile to view your assigned assets)</span>
          </div>
        )}
      </div>

      {/* Warning Banner if any Deactivated Employee is still holding Company Assets */}
      {deactivatedMembersWithAssets.length > 0 && (
        <div className="bg-rose-50/90 dark:bg-rose-950/30 border border-rose-300/80 dark:border-rose-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-950 dark:text-rose-200 space-y-1">
              <p className="font-bold">
                Equipment Follow-Up Required: Deactivated Employee Holding Company Assets
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-rose-800 dark:text-rose-300">
                {deactivatedMembersWithAssets.map((m) => {
                  const held = getMemberActiveAssets(m);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedProfileMemberId(m.id)}
                      className="underline hover:text-rose-950 dark:hover:text-white font-semibold cursor-pointer"
                    >
                      {m.name} ({held.map((a) => a.assetCode).join(", ")})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Search & Filters block */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search team members by name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Seniority Highlight Toggle Button */}
          <button
            type="button"
            onClick={() => setHighlightSeniority(!highlightSeniority)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer select-none ${
              highlightSeniority 
                ? "bg-amber-50 text-amber-900 border-amber-300 shadow-2xs hover:bg-amber-100/70 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/60 dark:hover:bg-amber-900/40" 
                : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700"
            }`}
            title="Toggle executive hierarchy visual highlighting (shadings, top borders, and rank tags)"
          >
            <Award className={`w-3.5 h-3.5 ${highlightSeniority ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"}`} />
            <span>Seniority Highlight: {highlightSeniority ? "ON" : "OFF"}</span>
          </button>

          <div className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase flex items-center gap-2">
            <span>Active Capacity:</span>
            <span className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold font-mono tabular-nums">
              {members.filter((m) => m.status !== "Deactivated").length} Active
            </span>
          </div>
        </div>
      </div>

      {/* Main Members Grid/Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6">Name</th>
                <th className="py-4 px-6">Email Address</th>
                <th className="py-4 px-6">Role</th>
                <th className="py-4 px-6">Assigned Assets</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
              {sortedMembers.length === 0 ? (
                <motion.tr
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-500 italic">
                    No matching team members found.
                  </td>
                </motion.tr>
              ) : (
                sortedMembers.map((member, index) => {
                  const rank = getTeamMemberRank(member);
                  const seniority = highlightSeniority ? getSeniorityStyle(rank) : null;
                  const prevMember = index > 0 ? sortedMembers[index - 1] : null;
                  const isTransitionToStandard = highlightSeniority && prevMember && getTeamMemberRank(prevMember) <= 4 && rank > 4;
                  const canViewAssets = canViewMemberAssets(member);
                  const activeMemberAssets = canViewAssets ? getMemberActiveAssets(member) : [];
                  const isDeactivated = member.status === "Deactivated";

                  return (
                    <Fragment key={member.id}>
                      {isTransitionToStandard && (
                        <tr className="bg-slate-100/70 dark:bg-slate-800/60 border-t-2 border-b border-slate-200/80 dark:border-slate-700/80">
                          <td colSpan={5} className="py-2.5 px-6">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                General Team Roster
                              </span>
                              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr 
                        onClick={() => {
                          if (canViewAssets) {
                            setSelectedProfileMemberId(member.id);
                          }
                        }}
                        className={`transition ${
                          canViewAssets ? "cursor-pointer" : ""
                        } ${
                          isDeactivated
                            ? "opacity-75 bg-slate-50/60 dark:bg-slate-900/40"
                            : seniority 
                            ? seniority.rowClass 
                            : "hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white align-top">
                          <div className="flex items-center gap-2.5 min-h-8">
                            {/* Avatar icon */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center uppercase tracking-wider text-xs shrink-0 ${
                              seniority 
                                ? seniority.avatar 
                                : "bg-slate-150 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300"
                            }`}>
                              {member.name.substring(0, 2)}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              <span className="truncate">{member.name}</span>
                              {seniority && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${seniority.badge}`}>
                                  <Award className="w-2.5 h-2.5" />
                                  {seniority.rankLabel}
                                </span>
                              )}
                              {isDeactivated && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shrink-0">
                                  Deactivated
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-600 dark:text-slate-400 font-mono text-xs align-top">
                          <div className="min-h-8 flex items-center">
                            {member.email.endsWith("@noemail.local") ? (
                              <span className="text-slate-400 dark:text-slate-500 italic font-sans">No Email Specified</span>
                            ) : (
                              member.email
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-600 dark:text-slate-300 font-medium align-top">
                          <div className="min-h-8 flex items-center">
                            {member.role}
                          </div>
                        </td>
                        <td className="py-4 px-6 align-top">
                          <div className="min-h-8 flex items-center">
                            {!canViewAssets ? (
                              <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                            ) : activeMemberAssets.length === 0 ? (
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                None assigned
                              </span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                                  {activeMemberAssets.map((a) => a.assetCode).join(", ")}
                                </span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                  ({activeMemberAssets.length})
                                </span>
                                {isDeactivated && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400"
                                    title="Deactivated employee still holding assets"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Follow-up
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td
                          className="py-4 px-6 text-right align-top whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5 min-h-8">
                            {canViewAssets && (
                              <button
                                type="button"
                                onClick={() => setSelectedProfileMemberId(member.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-md transition cursor-pointer"
                                title="View Employee Profile & Assigned Assets"
                              >
                                <Laptop className="w-3.5 h-3.5" />
                                <span>Assets</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleEdit(member)}
                                  className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
                                  title="Edit Details"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(member.id, member.name)}
                                  className="p-1.5 text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition cursor-pointer"
                                  title="Remove Member"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================================
          EMPLOYEE PROFILE & ASSIGNED ASSETS SLIDE-OVER PANEL
         ===================================================================== */}
      {selectedProfileMember && canViewMemberAssets(selectedProfileMember) && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs z-50 flex justify-end animate-fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setSelectedProfileMemberId(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            {/* Profile Header */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-start justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-full bg-slate-900 dark:bg-indigo-600 text-white font-bold flex items-center justify-center uppercase text-sm shrink-0">
                  {selectedProfileMember.name.substring(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white truncate">
                      {selectedProfileMember.name}
                    </h2>
                    <span
                      className={`text-xs font-semibold ${
                        selectedProfileMember.status === "Deactivated"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      · {selectedProfileMember.status === "Deactivated" ? "Deactivated" : "Active"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
                    <span>{selectedProfileMember.role}</span>
                    {!selectedProfileMember.email.endsWith("@noemail.local") && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{selectedProfileMember.email}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProfileMemberId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Admin Quick Actions on Employee */}
            {isAdmin && (
              <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignModalMember(selectedProfileMember)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Assign Asset
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(selectedProfileMember)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Profile
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleDeactivate(selectedProfileMember)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    selectedProfileMember.status === "Deactivated"
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300"
                  }`}
                >
                  <UserX className="w-3.5 h-3.5" />
                  {selectedProfileMember.status === "Deactivated"
                    ? "Reactivate Employee"
                    : "Deactivate Employee"}
                </button>
              </div>
            )}

            {/* Profile Body: Assigned Assets & Equipment History */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {(() => {
                const activeAssets = getMemberActiveAssets(selectedProfileMember);
                const memberHistory = getMemberAssignments(selectedProfileMember);
                const pastHistory = memberHistory.filter((h) => h.status === "Returned");

                return (
                  <>
                    {/* Warning if deactivated while holding assets */}
                    {selectedProfileMember.status === "Deactivated" && activeAssets.length > 0 && (
                      <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-950 dark:text-rose-200 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="font-bold">
                            Deactivated Employee Holding Company Equipment ({activeAssets.length})
                          </div>
                          <p className="text-rose-800 dark:text-rose-300 leading-relaxed">
                            This employee has been deactivated while still holding assigned assets. These assignments are preserved for follow-up until each item is returned.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Currently Assigned Assets Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <Laptop className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          Assigned Assets ({activeAssets.length})
                        </h3>
                      </div>

                      {activeAssets.length === 0 ? (
                        <div className="p-6 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-center space-y-2">
                          <Package className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            No assets currently assigned to {selectedProfileMember.name}
                          </p>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setAssignModalMember(selectedProfileMember)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer mt-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Assign Available Asset
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {activeAssets.map((asset) => {
                            const activeRecord = memberHistory.find(
                              (h) => h.assetId === asset.id && h.status === "Active"
                            );
                            const handoverAccessories =
                              activeRecord?.accessoriesHandedOver &&
                              activeRecord.accessoriesHandedOver.length > 0
                                ? activeRecord.accessoriesHandedOver
                                : asset.accessories || [];
                            const handoverCondition =
                              activeRecord?.conditionAtHandover || asset.condition;
                            const handoverDate =
                              activeRecord?.assignedDate || asset.assignedDate || "—";

                            return (
                              <div
                                key={asset.id}
                                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 shadow-2xs space-y-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                        {asset.assetCode}
                                      </span>
                                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                                        ·
                                      </span>
                                      <span className="text-slate-500 dark:text-slate-400">
                                        {asset.category}
                                      </span>
                                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                                        ·
                                      </span>
                                      <span className="text-slate-500 dark:text-slate-400">
                                        {asset.ownershipType}
                                      </span>
                                    </div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                                      {asset.assetName}
                                    </div>
                                  </div>

                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => setReturnModalAsset(asset)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      Return Asset
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/70 text-xs">
                                  <div>
                                    <span className="text-slate-400 dark:text-slate-500">
                                      Assignment Date:
                                    </span>{" "}
                                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                      {handoverDate}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 dark:text-slate-500">
                                      Condition at Handover:
                                    </span>{" "}
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                      {handoverCondition}
                                    </span>
                                  </div>
                                  <div className="col-span-2">
                                    <span className="text-slate-400 dark:text-slate-500">
                                      Accessories:
                                    </span>{" "}
                                    <span className="font-medium text-slate-800 dark:text-slate-200">
                                      {handoverAccessories.length > 0
                                        ? handoverAccessories.join(", ")
                                        : "None listed"}
                                    </span>
                                  </div>
                                  {activeRecord?.assignmentNotes && (
                                    <div className="col-span-2 text-slate-500 dark:text-slate-400">
                                      Handover Notes: {activeRecord.assignmentNotes}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Past Equipment Return History */}
                    {pastHistory.length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
                          <History className="w-4 h-4" />
                          Past Returned Equipment ({pastHistory.length})
                        </h3>
                        <div className="space-y-2.5">
                          {pastHistory.map((item) => (
                            <div
                              key={item.id}
                              className="p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 mr-1.5">
                                    {item.assetCode}
                                  </span>
                                  <span className="font-semibold text-slate-900 dark:text-white">
                                    {item.assetName}
                                  </span>
                                </div>
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                                  Returned {item.returnedDate || "—"}
                                </span>
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                                <span>Assigned: {item.assignedDate}</span>
                                <span>·</span>
                                <span>Return Condition: {item.conditionAtReturn || "—"}</span>
                              </div>
                              {item.missingOrDamagedItems && (
                                <div className="text-rose-600 dark:text-rose-400 font-semibold">
                                  Missing/Damaged: {item.missingOrDamagedItems}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Member Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 max-w-md w-full overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                {isEditing ? "Edit Team Member" : "Add Team Member"}
              </h2>
              <button 
                onClick={handleClose}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3.5 rounded-xl text-rose-900 dark:text-rose-300 text-xs flex gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Henry @ Htoo Aung Lin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-indigo-500 bg-slate-50/50 dark:bg-slate-800/60"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Email Address</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal normal-case font-sans">Optional</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. htooaung.lin@code-byte.io (or leave blank)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-indigo-500 bg-slate-50/50 dark:bg-slate-800/60 font-mono text-xs"
                />
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Role / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cybersecurity Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-indigo-500 bg-slate-50/50 dark:bg-slate-800/60"
                />
              </div>

              {/* Status (Active / Deactivated) */}
              {isEditing && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                    Employment Status
                  </label>
                  <select
                    value={memberStatus}
                    onChange={(e) => setMemberStatus(e.target.value as "Active" | "Deactivated")}
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/60 cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Deactivated">Deactivated</option>
                  </select>
                  {memberStatus === "Deactivated" &&
                    currentId &&
                    (() => {
                      const target = members.find((m) => m.id === currentId);
                      const held = target ? getMemberActiveAssets(target) : [];
                      if (held.length > 0) {
                        return (
                          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2 mt-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <span>
                              <strong>Warning:</strong> This employee currently holds{" "}
                              {held.length} assigned asset(s) ({held.map((a) => a.assetCode).join(", ")}).
                              Their asset assignments will be preserved and flagged for return follow-up.
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM REMOVE MEMBER DIALOG */}
      {deleteConfirmMember && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-md font-bold text-slate-900 dark:text-white">Remove Team Member?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">They will immediately lose leave portal access.</p>
              </div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-150 dark:border-slate-700 p-3 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 break-all">
              <span className="text-slate-400 dark:text-slate-500 font-semibold block uppercase text-[10px] tracking-wider mb-1">Target Member</span>
              {deleteConfirmMember.name}
            </div>

            {(() => {
              const target = members.find((m) => m.id === deleteConfirmMember.id);
              const held = target ? getMemberActiveAssets(target) : [];
              if (held.length > 0) {
                return (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-200 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Active Equipment Warning ({held.length} assigned)
                    </div>
                    <p className="leading-relaxed">
                      {deleteConfirmMember.name} currently holds:{" "}
                      <strong className="font-mono">{held.map((a) => a.assetCode).join(", ")}</strong>.
                      If you deactivate or remove them now, their asset assignments will be preserved and flagged for follow-up collection.
                    </p>
                  </div>
                );
              }
              return null;
            })()}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmMember(null)}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = members.find((m) => m.id === deleteConfirmMember.id);
                  if (target) {
                    await onUpdateMember(target.id, { status: "Deactivated" });
                  }
                  setDeleteConfirmMember(null);
                }}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer"
              >
                Deactivate Instead
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMember}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Asset Modal (from Employee Profile) */}
      <AssignAssetModal
        isOpen={!!assignModalMember}
        onClose={() => setAssignModalMember(null)}
        preselectedEmployee={assignModalMember}
        availableAssets={availableAssets}
        teamMembers={members}
        onAssign={onAssignAsset}
      />

      {/* Return Asset Modal (from Employee Profile) */}
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
    </div>
  );
}

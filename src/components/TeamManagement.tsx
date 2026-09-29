import { useState, FormEvent } from "react";
import { TeamMember, getTeamMemberRank } from "../types";
import { Users, Plus, Edit2, Trash2, Search, X, Check, ShieldAlert, AlertTriangle } from "lucide-react";
import { teamService } from "../firebase";
import { motion } from "motion/react";

interface TeamManagementProps {
  members: TeamMember[];
  onAddMember: (member: Omit<TeamMember, "id" | "createdAt">) => Promise<any>;
  onUpdateMember: (id: string, updates: Partial<Omit<TeamMember, "id" | "createdAt">>) => Promise<any>;
  onDeleteMember: (id: string) => Promise<any>;
  isLive: boolean;
  isAdmin?: boolean;
}

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
  members,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  isLive,
  isAdmin = false
}: TeamManagementProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  
  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Custom delete confirmation state (iframe-safe)
  const [deleteConfirmMember, setDeleteConfirmMember] = useState<{ id: string; name: string } | null>(null);

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

    const payload = {
      name: name.trim(),
      email: finalEmail,
      role: role.trim()
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
      setDeleteConfirmMember(null);
    } catch (err: any) {
      setError(err.message || "Removal failed.");
    }
  };

  const handleClose = () => {
    setName("");
    setEmail("");
    setRole("");
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

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 flex-1 max-w-7xl mx-auto w-full">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Team Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain the whitelisted team roster. Only registered members can access this application.
          </p>
        </div>
        {isAdmin ? (
          <button
            onClick={() => {
              setIsEditing(false);
              setIsOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Member
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-xl text-xs font-bold shadow-2xs">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Read-Only Roster (Admin privileges required to edit)</span>
          </div>
        )}
      </div>

      {/* Dynamic Search & Filters block */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search team members by name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white transition"
          />
        </div>
        <div className="text-xs text-slate-400 font-semibold uppercase flex items-center gap-2">
          <span>Active Capacity:</span>
          <span className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full font-bold">
            {members.length} Registered
          </span>
        </div>
      </div>

      {/* Main Members Grid/Table */}
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-6">Name</th>
                <th className="py-4 px-6">Email Address</th>
                <th className="py-4 px-6">Role</th>
                {isAdmin && <th className="py-4 px-6 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {sortedMembers.length === 0 ? (
                <motion.tr
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <td colSpan={isAdmin ? 4 : 3} className="py-8 text-center text-slate-400 italic">
                    No matching team members found.
                  </td>
                </motion.tr>
              ) : (
                sortedMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-6 font-semibold text-slate-900 align-top">
                      <div className="flex items-center gap-2.5 h-8">
                        {/* Avatar icon */}
                        <div className="w-8 h-8 rounded-full bg-slate-150 flex items-center justify-center font-bold text-slate-700 uppercase tracking-wider text-xs shrink-0">
                          {member.name.substring(0, 2)}
                        </div>
                        <span className="truncate">{member.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-mono text-xs align-top">
                      <div className="h-8 flex items-center">
                        {member.email.endsWith("@noemail.local") ? (
                          <span className="text-slate-400 italic font-sans">No Email Specified</span>
                        ) : (
                          member.email
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-550 font-medium align-top">
                      <div className="h-8 flex items-center">
                        {member.role}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="py-4 px-6 text-right align-top">
                        <div className="flex items-center justify-end gap-1.5 h-8">
                          <button
                            onClick={() => handleEdit(member)}
                            className="p-1.5 text-slate-500 hover:text-slate-950 hover:bg-slate-100 rounded-md transition cursor-pointer"
                            title="Edit Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(member.id, member.name)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer"
                            title="Remove Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Member Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-500" />
                {isEditing ? "Edit Team Member" : "Add Team Member"}
              </h2>
              <button 
                onClick={handleClose}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-rose-900 text-xs flex gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Henry @ Htoo Aung Lin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50/50"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Email Address</span>
                  <span className="text-[10px] text-slate-400 font-normal normal-case font-sans">Optional</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. htooaung.lin@code-byte.io (or leave blank)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50/50 font-mono text-xs"
                />
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Role / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cybersecurity Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50/50"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition shadow-sm flex items-center gap-1.5"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-md font-bold text-slate-900">Remove Team Member?</h3>
                <p className="text-xs text-slate-500 mt-1">They will immediately lose leave portal access.</p>
              </div>
            </div>
            
            <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl text-xs font-medium text-slate-700 break-all">
              <span className="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider mb-1">Target Member</span>
              {deleteConfirmMember.name}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmMember(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMember}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

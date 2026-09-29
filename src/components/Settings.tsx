import { useState, FormEvent } from "react";
import { AdminUser, TeamMember } from "../types";
import { adminService } from "../firebase";
import { 
  Shield, 
  UserPlus, 
  Trash2, 
  X, 
  Check, 
  AlertTriangle, 
  Info, 
  Loader2, 
  Mail, 
  Settings as SettingsIcon,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Monitor
} from "lucide-react";

interface SettingsProps {
  user: { email: string; name: string } | null;
  admins: AdminUser[];
  isLive: boolean;
  teamMembers: TeamMember[];
  onAddAdminSuccess?: () => void;
  onDeleteAdminSuccess?: () => void;
  themeMode?: "auto" | "light" | "dark";
  onThemeModeChange?: (mode: "auto" | "light" | "dark") => void;
  isAdmin?: boolean;
}

export default function Settings({
  user,
  admins,
  isLive,
  teamMembers = [],
  onAddAdminSuccess,
  onDeleteAdminSuccess,
  themeMode = "auto",
  onThemeModeChange,
  isAdmin = false
}: SettingsProps) {
  const [newEmail, setNewEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Safe delete confirmation state
  const [deleteConfirmAdmin, setDeleteConfirmAdmin] = useState<AdminUser | null>(null);

  const currentUserEmail = user?.email?.toLowerCase().trim() || "";

  // Filter team members who are not already admins
  const adminEmails = admins.map(a => a.email.toLowerCase().trim());
  const availableMembers = teamMembers.filter(member => 
    !adminEmails.includes(member.email.toLowerCase().trim())
  );

  const handleAddAdminSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const emailToValidate = newEmail.toLowerCase().trim();
    if (!emailToValidate) {
      setError("Please select a team member from the list.");
      return;
    }

    // Check if already an admin
    const alreadyAdmin = admins.some(a => a.email.toLowerCase() === emailToValidate);
    if (alreadyAdmin) {
      setError("This email address is already assigned as an administrator.");
      return;
    }

    setSubmitting(true);
    try {
      if (isLive) {
        await adminService.addAdmin(emailToValidate);
      }
      setSuccess(`"${emailToValidate}" has been successfully added as an administrator!`);
      setNewEmail("");
      if (onAddAdminSuccess) onAddAdminSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to add administrator. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmAdmin) return;
    setError(null);
    setSuccess(null);

    const targetEmail = deleteConfirmAdmin.email.toLowerCase().trim();

    // Safety check 1: Can't delete self
    if (targetEmail === currentUserEmail) {
      setError("For security and lockout prevention, you cannot revoke your own administrator privileges.");
      setDeleteConfirmAdmin(null);
      return;
    }

    // Safety check 2: Can't delete last admin
    if (admins.length <= 1) {
      setError("Revocation blocked. At least one administrator account must persist in the system.");
      setDeleteConfirmAdmin(null);
      return;
    }

    setSubmitting(true);
    try {
      if (isLive) {
        await adminService.deleteAdmin(deleteConfirmAdmin.id);
      }
      setSuccess(`"${targetEmail}" has been successfully revoked from the administrator group.`);
      if (onDeleteAdminSuccess) onDeleteAdminSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to revoke administrator privileges.");
    } finally {
      setSubmitting(false);
      setDeleteConfirmAdmin(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 flex-1 max-w-5xl mx-auto animate-fade-in text-slate-950 dark:text-slate-100">
      {/* Header section */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-950 dark:text-white tracking-tight flex items-center gap-2.5">
          <SettingsIcon className="w-7 h-7 text-slate-950 dark:text-white" />
          {isAdmin ? "System Settings" : "Preferences"}
        </h1>
        <p className="text-sm text-slate-950 dark:text-slate-300 mt-2 font-bold">
          {isAdmin 
            ? "Configure administrative privileges and review active authorization credentials." 
            : "Manage your personal theme settings and application display preferences."}
        </p>
      </div>

      {/* Grid/Flex Layout: Admin Assignment & Theme Preference */}
      <div className={isAdmin ? "grid grid-cols-1 lg:grid-cols-3 gap-8" : "max-w-2xl"}>
        
        {/* Left/Middle Column: Administrators Management list */}
        <div className={isAdmin ? "lg:col-span-2 space-y-6" : "space-y-6"}>
          {isAdmin && (
            <>
              <div className="bg-white dark:bg-[#171a26] rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-[#12141f]">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                Active Administrators ({admins.length})
              </h2>
            </div>

            {/* Success and Error Indicators */}
            {success && (
              <div className="m-5 p-3 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30 rounded-xl flex items-start gap-2.5 text-emerald-800 dark:text-emerald-400 text-xs font-semibold animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            {error && (
              <div className="m-5 p-3 bg-rose-50 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/30 rounded-xl flex items-start gap-2.5 text-rose-800 dark:text-rose-400 text-xs font-semibold animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* List of Admins */}
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {admins.map((admin) => {
                const isAdminSelf = admin.email.toLowerCase() === currentUserEmail;
                return (
                  <div key={admin.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-[#1e2233] transition bg-white dark:bg-[#171a26]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                        isAdminSelf ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-650 border border-slate-200/50 dark:bg-slate-800 dark:text-slate-350 dark:border-white/5"
                      }`}>
                        {admin.email.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{admin.email}</span>
                          {isAdminSelf && (
                            <span className="inline-flex items-center text-[9px] font-extrabold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-350 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/30">
                              You
                            </span>
                          )}
                        </div>
                        {admin.createdAt && (
                          <span className="text-[10px] text-slate-550 dark:text-slate-400 block font-semibold mt-0.5 font-mono">
                            Added: {new Date(admin.createdAt.seconds * 1000).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Revoke Action */}
                    {!isAdminSelf && (
                      <button
                        onClick={() => setDeleteConfirmAdmin(admin)}
                        disabled={submitting}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50/60 dark:hover:bg-rose-950/20 rounded-lg transition disabled:opacity-50 cursor-pointer bg-white dark:bg-transparent"
                        title="Revoke Administrator Privileges"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {admins.length === 0 && (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm italic font-semibold">
                  No active administrators found in database. Setting fallbacks.
                </div>
              )}
            </div>
          </div>

          {/* Quick Add Form */}
          <div className="bg-white dark:bg-[#171a26] rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-xs p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <UserPlus className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" />
              Assign New Administrator
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                Select an existing team member from the dropdown below to grant them full system administrator privileges.
            </p>

            <form onSubmit={handleAddAdminSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <select
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={submitting || availableMembers.length === 0}
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 dark:bg-[#12141f] dark:border-white/5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white dark:focus:bg-[#171a26] transition text-slate-800 dark:text-slate-200 font-semibold appearance-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {availableMembers.length === 0 ? (
                    <option value="">No available team members to promote</option>
                  ) : (
                    <>
                      <option value="">Select a registered team member...</option>
                      {availableMembers.map((m) => (
                        <option key={m.id} value={m.email} className="dark:bg-[#171a26]">
                          {m.name} ({m.email})
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                  <svg className="fill-current h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting || !newEmail}
                className="inline-flex items-center justify-center gap-1.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition shrink-0 cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <Check className="w-4.5 h-4.5" />
                )}
                <span>Grant Admin Role</span>
              </button>
            </form>
          </div>
          </>
          )}

          {/* Theme Settings Form/Selector */}
          <div className="bg-white dark:bg-[#171a26] rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-xs p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Sun className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" />
              Theme Configuration
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
              Select your preferred display appearance. 'Auto' will automatically match your system's light or dark mode settings.
            </p>

            <div className="grid grid-cols-3 gap-3.5 pt-2">
              {[
                { id: "auto", label: "Auto (System)", desc: "Match device theme", icon: Monitor },
                { id: "light", label: "Light Mode", desc: "Clean & high contrast", icon: Sun },
                { id: "dark", label: "Dark Mode", desc: "Obsidian & metallic glow", icon: Moon }
              ].map((themeOpt) => {
                const isSelected = themeMode === themeOpt.id;
                const Icon = themeOpt.icon;
                return (
                  <button
                    key={themeOpt.id}
                    type="button"
                    onClick={() => onThemeModeChange?.(themeOpt.id as "auto" | "light" | "dark")}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border transition cursor-pointer text-center space-y-2 ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/25 dark:border-indigo-500 dark:bg-indigo-950/20 text-indigo-750 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                        : "border-slate-200 bg-slate-50/30 hover:bg-slate-50 dark:border-white/5 dark:bg-[#12141f] dark:hover:bg-[#1e2233] text-slate-700 dark:text-slate-350"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isSelected ? "text-indigo-650 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`} />
                    <div className="text-xs font-bold">{themeOpt.label}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold leading-normal">{themeOpt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Roles & Guidelines info box */}
        {isAdmin && (
          <div className="space-y-6">
            <div className="bg-indigo-50/90 dark:bg-indigo-950/20 border-2 border-indigo-200 dark:border-indigo-500/20 rounded-2xl p-6 space-y-4 shadow-sm">
              <h3 className="text-sm font-black text-indigo-950 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                <Info className="w-4.5 h-4.5 text-indigo-950 dark:text-indigo-400" />
                Admin Capabilities
              </h3>

              <div className="space-y-4 text-xs leading-relaxed font-bold">
                <div className="space-y-1.5">
                  <h4 className="font-black text-indigo-950 dark:text-slate-100 text-[13px] tracking-wide">
                    📋 Roster Management
                  </h4>
                  <p className="text-indigo-950/90 dark:text-slate-300 leading-relaxed font-semibold">
                    Administrators can register new team members, edit active profile roles, and manage credentials in the Team Management tab.
                  </p>
                </div>

                <div className="space-y-1.5 pt-3 border-t-2 border-indigo-200 dark:border-indigo-500/15">
                  <h4 className="font-black text-indigo-950 dark:text-slate-100 text-[13px] tracking-wide">
                    📁 Project Timelines
                  </h4>
                  <p className="text-indigo-950/90 dark:text-slate-300 leading-relaxed font-semibold">
                    Admins can initialize project dashboards, set priorities, and track ongoing progress and checklists.
                  </p>
                </div>

                <div className="space-y-1.5 pt-3 border-t-2 border-indigo-200 dark:border-indigo-500/15">
                  <h4 className="font-black text-indigo-950 dark:text-slate-100 text-[13px] tracking-wide">
                    🗓️ Leave Registrations
                  </h4>
                  <p className="text-indigo-950/90 dark:text-slate-300 leading-relaxed font-semibold">
                    View leave statistics across all members and access full leave request logs inside the central Leave Requests dashboard.
                  </p>
                </div>

                {/* Live Status indicator */}
                <div className="pt-3 border-t-2 border-indigo-200 dark:border-indigo-500/15 flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${isLive ? "bg-emerald-600 animate-pulse" : "bg-slate-650"}`} />
                  <span className="font-extrabold text-indigo-950 dark:text-slate-300 text-xs">
                    {isLive ? "Live Sync Active" : "Offline Sandbox Fallback"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Safe Revocation Confirmation Dialog Modal */}
      {deleteConfirmAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-[#171a26] rounded-2xl shadow-xl border border-slate-100 dark:border-white/5 max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-150/60 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-[#12141f]">
              <h3 className="text-md font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Revoke Admin Role?
              </h3>
              <button 
                onClick={() => setDeleteConfirmAdmin(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 rounded-md transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-semibold">
                Are you sure you want to revoke administrator access for:
              </p>
              <div className="bg-slate-50 dark:bg-[#12141f] border border-slate-150/60 dark:border-white/5 rounded-xl p-3 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 break-all">
                  {deleteConfirmAdmin.email}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal font-semibold">
                This will immediately remove their privileges to manage project boards, configure administrators, and manage team member rosters. They will remain listed in the company roster.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-3 bg-slate-50 dark:bg-[#12141f]">
              <button
                type="button"
                onClick={() => setDeleteConfirmAdmin(null)}
                className="px-4 py-1.5 bg-white dark:bg-[#171a26] border border-slate-250/60 dark:border-white/10 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1e2233] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={submitting}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Revoke Access</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

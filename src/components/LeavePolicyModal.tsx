import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileText, 
  Download, 
  X, 
  ShieldCheck, 
  Clock, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  ChevronRight,
  BookOpen,
  UserCheck,
  Building2,
  Stethoscope,
  Briefcase
} from "lucide-react";
import { generateCodeBytePolicyPdf } from "../utils/generatePolicyPdf";

interface LeavePolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeavePolicyModal: React.FC<LeavePolicyModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"summary" | "hours" | "entitlements" | "procedure" | "disciplinary">("summary");
  const [searchQuery, setSearchQuery] = useState<string>("");

  if (!isOpen) return null;

  const handleDownloadPdf = () => {
    generateCodeBytePolicyPdf();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/65 backdrop-blur-xs animate-fade-in">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden my-auto"
        >
          {/* Header Banner */}
          <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                    CodeByte Leave Policy & Guidelines
                  </h2>
                  <span className="text-[10px] font-mono font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                    Cod/POL/01
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                  <span>Effective Date: <strong>16/02/2026</strong></span>
                  <span>•</span>
                  <span>Version V1.0</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-semibold">Confidential</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                title="Download Official CodeByte Policy PDF"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download PDF</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Subheader & Tab Controls */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 p-2 sm:px-6 sm:py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full">
              {[
                { id: "summary", label: "Overview & Scope", icon: Building2 },
                { id: "hours", label: "Working Hours", icon: Clock },
                { id: "entitlements", label: "Leave Entitlements", icon: Calendar },
                { id: "procedure", label: "Application Rules", icon: ShieldCheck },
                { id: "disciplinary", label: "Disciplinary", icon: AlertCircle },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative hidden md:block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search policy terms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Modal Content Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-200 leading-relaxed text-sm">
            {searchQuery && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200">
                Searching for: <strong>"{searchQuery}"</strong>
              </div>
            )}

            {/* TAB 1: OVERVIEW & SCOPE */}
            {(activeTab === "summary" || searchQuery) && (
              <div className="space-y-4">
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-4 sm:p-5">
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2 mb-2">
                    <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    1. Objective & Purpose
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
                    This policy defines the rules governing employee attendance, working hours, punctuality, and leave entitlements at <strong>CodeByte Company Limited</strong>. It establishes clear expectations and procedures to ensure operational continuity, accountability, and fair treatment of all team members.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-500" />
                      Policy Applies To
                    </h4>
                    <ul className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        All permanent, contract, and probationary employees.
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        All departments and business units across CodeByte.
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Applies regardless of role or seniority.
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-500" />
                      Document Metadata
                    </h4>
                    <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                      <p><strong>Document Title:</strong> Employee Attendance, Working Hours & Leave Policy</p>
                      <p><strong>Document ID:</strong> Cod/POL/01</p>
                      <p><strong>Effective Date:</strong> 16/02/2026 (Version V1.0)</p>
                      <p><strong>Approved By:</strong> Samson Paing Minn</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: WORKING HOURS & PUNCTUALITY */}
            {(activeTab === "hours" || searchQuery) && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    2. Official Working Hours & Punctuality
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="block font-extrabold text-slate-900 dark:text-white text-sm">
                        9:00 AM – 5:00 PM
                      </span>
                      <span className="text-slate-500">Monday to Friday (Official Hours)</span>
                    </div>

                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                      <span className="block font-extrabold text-sm">
                        Lateness Threshold: +15 Mins
                      </span>
                      <span className="text-xs opacity-90">Arrivals after 9:15 AM count as official lateness.</span>
                    </div>
                  </div>

                  <div className="text-xs space-y-2 text-slate-700 dark:text-slate-300 pt-2">
                    <p className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <span>Employees must be present and performing duties during official working hours unless approved leave has been granted in advance.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <span><strong>Notice is Not Approval:</strong> Informing managers or colleagues via group chats (Slack, Telegram, WhatsApp) or verbal notice does <strong>NOT</strong> constitute leave approval. Formal submission in this portal is mandatory.</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: LEAVE ENTITLEMENTS */}
            {(activeTab === "entitlements" || searchQuery) && (
              <div className="space-y-4">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  3. Annual Leave Entitlements
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Paid Annual Leave */}
                  <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-indigo-900 dark:text-indigo-200 text-sm flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-indigo-600" />
                        Paid Annual Leave
                      </span>
                      <span className="text-xs font-mono font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                        10 Days / Yr
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Full salary entitlement. Must be applied and approved in advance. Eligible for refund if not taken throughout the year.
                    </p>
                  </div>

                  {/* Casual / Urgent Leave */}
                  <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-amber-900 dark:text-amber-200 text-sm flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-600" />
                        Casual / Urgent Leave
                      </span>
                      <span className="text-xs font-mono font-bold bg-amber-600 text-white px-2 py-0.5 rounded-full">
                        6 Days / Yr
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Full salary entitlement for urgent matters. Subject to management discretion. Non-refundable if unused.
                    </p>
                  </div>

                  {/* Medical Leave */}
                  <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/30 dark:bg-teal-950/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-teal-900 dark:text-teal-200 text-sm flex items-center gap-1.5">
                        <Stethoscope className="w-4 h-4 text-teal-600" />
                        Medical Leave
                      </span>
                      <span className="text-xs font-mono font-bold bg-teal-600 text-white px-2 py-0.5 rounded-full">
                        24 Days / Yr
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      2 days/month allowance for illness/injury. Valid medical certificate required for requests exceeding 1 day. Non-refundable.
                    </p>
                  </div>

                  {/* Unpaid Leave */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 dark:text-slate-200 text-sm flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-slate-500" />
                        Unpaid Leave
                      </span>
                      <span className="text-xs font-mono font-bold bg-slate-600 text-white px-2 py-0.5 rounded-full">
                        Up to 20 Days
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Granted without salary entitlement, subject to strict management approval and operational needs. Non-refundable.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs text-slate-600 dark:text-slate-400">
                  <strong>Proration Rule:</strong> Employees who do not complete a full year of service have leave entitlements prorated based on months of service, with fractions rounded down to the nearest whole number (e.g. 2.4 days = 2 days).
                </div>
              </div>
            )}

            {/* TAB 4: APPLICATION RULES */}
            {(activeTab === "procedure" || searchQuery) && (
              <div className="space-y-4">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  4. Leave Application & Approval Rules
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3.5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <strong>Official Portal Only:</strong> All requests must be processed through this designated CodeByte portal.
                    </div>
                  </div>

                  <div className="p-3.5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <strong>Explicit Approval Required:</strong> Leave is officially granted ONLY upon confirmation from HR/Admin.
                    </div>
                  </div>

                  <div className="p-3.5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <strong>Medical Documentation:</strong> Medical certificates / doctor's notes are required for medical leave exceeding 1 day.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: DISCIPLINARY */}
            {(activeTab === "disciplinary" || searchQuery) && (
              <div className="space-y-4">
                <h3 className="font-extrabold text-rose-900 dark:text-rose-300 text-base flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  5. Disciplinary Framework & Penalties
                </h3>

                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl space-y-2 text-xs text-rose-900 dark:text-rose-200">
                  <p className="font-bold">Failure to comply with attendance or leave procedures may result in disciplinary action:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Verbal Warning</li>
                    <li>Written Warning</li>
                    <li>Final Written Warning</li>
                    <li>Suspension or Salary Adjustment</li>
                    <li>Termination of Employment without further notice for persistent misconduct</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              CodeByte HR & People Operations • Document ID: <strong>Cod/POL/01</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF Document</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

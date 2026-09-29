import { useState, useEffect, useRef, FormEvent } from "react";
import { LeaveRequest, LeaveType, LeaveAttachment, TeamMember, getDaysDifference, getMonthsInRange, getWorkingDaysInMonth } from "../types";
import { leaveService } from "../firebase";
import { getBurmeseHoliday, getBurmeseHolidaysInMonth, getBurmeseHolidaysInRange } from "../data/burmeseHolidays";
import { motion } from "motion/react";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Check, 
  X, 
  AlertTriangle, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  User, 
  ShieldAlert,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  Mail,
  Send,
  Flag,
  Info,
  RefreshCw,
  TrendingUp,
  BarChart2,
  AlertCircle,
  Edit,
  Trash2,
  Paperclip,
  Upload,
  Download,
  ExternalLink
} from "lucide-react";

import { LeavePolicyModal } from "./LeavePolicyModal";
import { generateCodeBytePolicyPdf } from "../utils/generatePolicyPdf";

interface LeaveRequestsProps {
  user: { email: string; name: string } | null;
  teamMembers: TeamMember[];
  isLive: boolean;
  leaveRequests: LeaveRequest[];
  loadingLeaves: boolean;
  adminEmails: string[];
}

export default function LeaveRequests({ 
  user, 
  teamMembers, 
  isLive, 
  leaveRequests, 
  loadingLeaves,
  adminEmails = []
}: LeaveRequestsProps) {
  const ADMIN_EMAILS = adminEmails && adminEmails.length > 0 ? adminEmails : [
    "htooaung.lin@code-byte.io",
    "ju.zaw@code-byte.io",
    "samson@code-byte.io",
    "yehtet.zaw@code-byte.io"
  ];
  const [requests, setRequests] = useState<LeaveRequest[]>(leaveRequests);
  const [loading, setLoading] = useState<boolean>(loadingLeaves);
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [showSentConfirmation, setShowSentConfirmation] = useState<boolean>(false);
  const formRef = useRef<HTMLDivElement>(null);
  const adminFormRef = useRef<HTMLDivElement>(null);
  const [submittedRequestDetails, setSubmittedRequestDetails] = useState<{
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    notifiedAdmins: string[];
    dayType?: "Full Day" | "AM" | "PM";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);

  // Form states
  const [leaveType, setLeaveType] = useState<LeaveType>("Annual Leave");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [dayType, setDayType] = useState<"Full Day" | "AM" | "PM">("Full Day");
  const [attachments, setAttachments] = useState<LeaveAttachment[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // File upload handler with compression and Firestore serialization safeguards
  const processFileAttachment = (file: File): Promise<LeaveAttachment> => {
    return new Promise((resolve, reject) => {
      const isImage = file.type.startsWith("image/");
      const reader = new FileReader();

      reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));

      if (isImage) {
        reader.onload = (uploadEvent) => {
          const rawUrl = uploadEvent.target?.result as string;
          const img = new Image();
          img.onload = () => {
            const maxDim = 1000;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressedUrl = canvas.toDataURL("image/jpeg", 0.7);
              resolve({
                name: file.name.replace(/\.[^/.]+$/, "") + ".jpg",
                url: compressedUrl,
                size: Math.round((compressedUrl.length * 3) / 4),
                type: "image/jpeg"
              });
              return;
            }
            resolve({
              name: file.name || "attachment",
              url: rawUrl,
              size: file.size || 0,
              type: file.type || "image/jpeg"
            });
          };
          img.onerror = () => {
            resolve({
              name: file.name || "attachment",
              url: rawUrl,
              size: file.size || 0,
              type: file.type || "image/jpeg"
            });
          };
          img.src = rawUrl;
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = (uploadEvent) => {
          const rawUrl = uploadEvent.target?.result as string;
          resolve({
            name: file.name || "attachment",
            url: rawUrl || "",
            size: file.size || 0,
            type: file.type || "application/pdf"
          });
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, targetMode: "normal" | "edit" | "admin" = "normal") => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    for (const file of filesArray) {
      if (!file.type.startsWith("image/") && file.size > 700 * 1024) {
        const msg = `File "${file.name}" exceeds 700KB database size limit. Please upload a smaller document or an image.`;
        if (targetMode === "edit") setEditError(msg);
        else setError(msg);
        continue;
      }

      try {
        const att = await processFileAttachment(file);
        const cleanAtt: LeaveAttachment = {
          name: String(att.name || "attachment"),
          url: String(att.url || ""),
          size: Number(att.size || 0),
          type: String(att.type || "application/octet-stream")
        };

        if (targetMode === "edit") {
          setEditAttachments(prev => [...prev, cleanAtt]);
        } else if (targetMode === "admin") {
          setAdminAttachments(prev => [...prev, cleanAtt]);
        } else {
          setAttachments(prev => [...prev, cleanAtt]);
        }
      } catch (err: any) {
        const msg = `Failed to process file "${file.name}".`;
        if (targetMode === "edit") setEditError(msg);
        else setError(msg);
      }
    }
    e.target.value = "";
  };

  // Calendar states
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth());
  const [showHolidaysModal, setShowHolidaysModal] = useState<boolean>(false);
  const [selectedCalDate, setSelectedCalDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });

  // Multi-Year & Annual Reset Selector States
  const currentCalYearStr = new Date().getFullYear().toString();
  const [selectedLeaveYear, setSelectedLeaveYear] = useState<string>(currentCalYearStr);
  const [showAdminResetMatrix, setShowAdminResetMatrix] = useState<boolean>(false);
  const [showCoverageDetector, setShowCoverageDetector] = useState<boolean>(true);

  // History states
  const [selectedEmployeeEmail, setSelectedEmployeeEmail] = useState<string>("all");
  const [selectedHistoryLeaveType, setSelectedHistoryLeaveType] = useState<string>("all");
  const [selectedHistoryStatus, setSelectedHistoryStatus] = useState<string>("all");
  const [selectedHistoryYear, setSelectedHistoryYear] = useState<string>("all");
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");
  const [csvDownloadSuccess, setCsvDownloadSuccess] = useState<string | null>(null);
  const [activeHistoryTab, setActiveHistoryTab] = useState<"team-history" | "my-history">("my-history");
  const [statsSearch, setStatsSearch] = useState<string>("");
  const [statsMonth, setStatsMonth] = useState<string>("all");
  const [statsYear, setStatsYear] = useState<string>("all");
  const [statsEmployee, setStatsEmployee] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hoveredCalDate, setHoveredCalDate] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 10;

  // Admin Historical Log states
  const [adminFormOpen, setAdminFormOpen] = useState<boolean>(false);
  const [adminSelectedEmail, setAdminSelectedEmail] = useState<string>("");
  const [adminLeaveType, setAdminLeaveType] = useState<LeaveType>("Annual Leave");
  const [adminStartDate, setAdminStartDate] = useState<string>("");
  const [adminEndDate, setAdminEndDate] = useState<string>("");
  const [adminReason, setAdminReason] = useState<string>("");
  const [adminDayType, setAdminDayType] = useState<"Full Day" | "AM" | "PM">("Full Day");
  const [adminAttachments, setAdminAttachments] = useState<LeaveAttachment[]>([]);
  const [adminSubmitting, setAdminSubmitting] = useState<boolean>(false);

  // Admin Edit Leave Request states
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [editLeaveType, setEditLeaveType] = useState<LeaveType>("Annual Leave");
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editEndDate, setEditEndDate] = useState<string>("");
  const [editDayType, setEditDayType] = useState<"Full Day" | "AM" | "PM">("Full Day");
  const [editReason, setEditReason] = useState<string>("");
  const [editStatus, setEditStatus] = useState<"Pending" | "Approved" | "Denied">("Approved");
  const [editAttachments, setEditAttachments] = useState<LeaveAttachment[]>([]);
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleOpenEditModal = (req: LeaveRequest) => {
    setEditingRequest(req);
    setEditLeaveType(req.leaveType);
    setEditStartDate(req.startDate);
    setEditEndDate(req.endDate);
    setEditDayType(req.dayType || "Full Day");
    setEditReason(req.reason || "");
    setEditStatus(req.status);
    setEditAttachments(req.attachments || []);
    setEditError(null);
  };

  const handleSaveEditRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingRequest) return;
    
    if (!editStartDate) {
      setEditError("Start date is required.");
      return;
    }

    const effectiveEndDate = editDayType !== "Full Day" ? editStartDate : (editEndDate || editStartDate);
    if (effectiveEndDate < editStartDate) {
      setEditError("End date cannot be earlier than start date.");
      return;
    }

    if (editStatus !== "Denied") {
      const quotaCheck = validateLeaveQuota(
        editingRequest.requestorEmail,
        editLeaveType,
        editStartDate,
        effectiveEndDate,
        editDayType,
        editingRequest.id
      );
      if (!quotaCheck.valid && quotaCheck.errorMsg) {
        setEditError(quotaCheck.errorMsg);
        return;
      }
    }

    setEditSubmitting(true);
    setEditError(null);

    try {
      const cleanEditAttachments = (editAttachments || []).map(a => ({
        name: String(a.name || "Attachment"),
        url: String(a.url || ""),
        size: Number(a.size || 0),
        type: String(a.type || "application/octet-stream")
      }));

      const updates = {
        leaveType: editLeaveType,
        startDate: editStartDate,
        endDate: effectiveEndDate,
        dayType: editDayType,
        reason: editReason,
        status: editStatus,
        attachments: cleanEditAttachments
      };

      if (isLive) {
        await leaveService.updateLeaveRequest(editingRequest.id, updates);
      }

      setRequests(prev => prev.map(r => r.id === editingRequest.id ? { ...r, ...updates } : r));
      setSuccess(`Successfully updated leave request form for ${editingRequest.requestorName}.`);
      setEditingRequest(null);
    } catch (err: any) {
      console.error("Error updating leave request:", err);
      setEditError("Failed to update leave request. Please try again.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const currentUserEmail = user?.email || "";
  const currentUserName = user?.name || "Requestor";
  const isAdmin = ADMIN_EMAILS.map(e => e.toLowerCase().trim()).includes(currentUserEmail.toLowerCase().trim());

  const STORAGE_KEY = "codebyte_fallback_leave_requests";

  // Helper: Get overlapping approved leaves from OTHER team members for a given date range
  const getTeamOverlapsForRange = (requestorEmail: string, startStr: string, endStr: string) => {
    if (!startStr || !endStr) return [];
    const reqEmailLower = requestorEmail.toLowerCase().trim();
    
    return requests.filter(req => {
      if (req.status !== "Approved") return false;
      if (req.requestorEmail?.toLowerCase().trim() === reqEmailLower) return false;
      
      const s1 = req.startDate;
      const e1 = req.endDate;
      const s2 = startStr;
      const e2 = endStr;
      
      return s1 <= e2 && s2 <= e1;
    });
  };

  // Helper: Find upcoming team overlap clusters (dates with 2+ members away) in the next 60 days
  const getUpcomingOverlapClusters = () => {
    const today = new Date();
    const clusters: { dateStr: string; awayRequests: LeaveRequest[]; count: number; capacityPct: number }[] = [];
    const totalTeamSize = teamMembers.length || 1;
    
    for (let i = 0; i < 60; i++) {
      const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (isWeekend) continue;
      
      const approvedOnDay = requests.filter(r => r.status === "Approved" && r.startDate <= dateStr && r.endDate >= dateStr);
      const uniqueAwayEmails = new Set(approvedOnDay.map(r => r.requestorEmail?.toLowerCase().trim()));
      
      if (uniqueAwayEmails.size >= 2) {
        const available = Math.max(0, totalTeamSize - uniqueAwayEmails.size);
        const capacityPct = Math.round((available / totalTeamSize) * 100);
        clusters.push({
          dateStr,
          awayRequests: approvedOnDay,
          count: uniqueAwayEmails.size,
          capacityPct
        });
      }
    }
    
    return clusters;
  };

  // Helper: Days until next Jan 1 annual reset
  const getDaysUntilNextReset = () => {
    const now = new Date();
    const nextResetYear = now.getFullYear() + 1;
    const nextResetDate = new Date(nextResetYear, 0, 1);
    const diffMs = nextResetDate.getTime() - now.getTime();
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  };

  // Sync state with props
  useEffect(() => {
    setRequests(leaveRequests);
  }, [leaveRequests]);

  useEffect(() => {
    if (isAdmin) {
      setActiveHistoryTab("team-history");
    } else {
      setActiveHistoryTab("my-history");
    }
  }, [isAdmin]);

  useEffect(() => {
    setLoading(loadingLeaves);
  }, [loadingLeaves]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeHistoryTab, selectedEmployeeEmail]);

  // Overlap checking helper
  const checkLeaveOverlap = (
    email: string,
    start: string,
    end: string,
    type: "Full Day" | "AM" | "PM",
    excludeId?: string
  ): { hasOverlap: boolean; overlappingRequest?: LeaveRequest } => {
    const employeeEmail = email.toLowerCase().trim();
    
    const overlap = requests.find(req => {
      if (req.id === excludeId) return false;
      if (req.requestorEmail.toLowerCase().trim() !== employeeEmail) return false;
      if (req.status !== "Approved" && req.status !== "Pending") return false;
      
      const s1 = new Date(start);
      const e1 = new Date(end);
      const s2 = new Date(req.startDate);
      const e2 = new Date(req.endDate);
      
      const datesOverlap = s1 <= e2 && s2 <= e1;
      if (!datesOverlap) return false;
      
      const intersectStart = start > req.startDate ? start : req.startDate;
      const intersectEnd = end < req.endDate ? end : req.endDate;
      
      if (intersectStart <= intersectEnd) {
        if (intersectStart === intersectEnd) {
          const type1 = type;
          const type2 = req.dayType || "Full Day";
          if (
            (type1 === "AM" && type2 === "PM") ||
            (type1 === "PM" && type2 === "AM")
          ) {
            return false;
          }
        }
        return true;
      }
      return false;
    });
    
    return {
      hasOverlap: !!overlap,
      overlappingRequest: overlap
    };
  };

  // Helper to validate quota limits (10 Annual, 6 Casual, 24 Medical days / year)
  const validateLeaveQuota = (
    email: string,
    type: LeaveType,
    startDt: string,
    endDt: string,
    dType?: "Full Day" | "AM" | "PM",
    excludeRequestId?: string
  ): { valid: boolean; errorMsg?: string } => {
    if (type === "Unpaid Leave") return { valid: true };

    const isHalf = dType === "AM" || dType === "PM";
    const reqDays = getDaysDifference(startDt, isHalf ? startDt : endDt) * (isHalf ? 0.5 : 1.0);
    const targetYr = startDt ? startDt.substring(0, 4) : new Date().getFullYear().toString();

    const userActiveInYr = requests.filter(r => 
      r.requestorEmail?.toLowerCase().trim() === email.toLowerCase().trim() &&
      r.status !== "Denied" &&
      (excludeRequestId ? r.id !== excludeRequestId : true) &&
      (r.startDate ? r.startDate.substring(0, 4) === targetYr : true)
    );

    const getUsedDays = (matchFn: (t: LeaveType) => boolean) => {
      return userActiveInYr.reduce((sum, r) => {
        if (!matchFn(r.leaveType)) return sum;
        const count = getDaysDifference(r.startDate, r.endDate);
        const half = r.dayType === "AM" || r.dayType === "PM";
        return sum + (count * (half ? 0.5 : 1.0));
      }, 0);
    };

    if (type === "Annual Leave") {
      const used = getUsedDays(t => t === "Annual Leave");
      const max = 10;
      if (used >= max) {
        return {
          valid: false,
          errorMsg: `Annual Leave Limit Reached: You have already used all 10.0 of your annual Annual Leave days (${used} / 10.0 days). No further Annual Leave can be requested.`
        };
      }
      if (used + reqDays > max) {
        const remaining = Math.max(0, max - used);
        return {
          valid: false,
          errorMsg: `Annual Leave Quota Exceeded: You have used ${used} of 10.0 Annual Leave days. Requesting ${reqDays} day(s) exceeds your remaining balance of ${remaining} day(s).`
        };
      }
    } else if (type === "Casual Leave" || type === "Urgent Leave") {
      const used = getUsedDays(t => t === "Casual Leave" || t === "Urgent Leave");
      const max = 6;
      if (used >= max) {
        return {
          valid: false,
          errorMsg: `Casual Leave Limit Reached: You have already used all 6.0 of your annual Casual Leave days (${used} / 6.0 days). No further Casual Leave can be requested.`
        };
      }
      if (used + reqDays > max) {
        const remaining = Math.max(0, max - used);
        return {
          valid: false,
          errorMsg: `Casual Leave Quota Exceeded: You have used ${used} of 6.0 Casual Leave days. Requesting ${reqDays} day(s) exceeds your remaining balance of ${remaining} day(s).`
        };
      }
    } else if (type === "Medical Leave") {
      const usedAnnual = getUsedDays(t => t === "Medical Leave");
      const maxAnnual = 24;
      if (usedAnnual >= maxAnnual) {
        return {
          valid: false,
          errorMsg: `Medical Leave Annual Limit Reached: You have already used all 24.0 of your annual Medical Leave days (${usedAnnual} / 24.0 days). No further Medical Leave can be requested.`
        };
      }
      if (usedAnnual + reqDays > maxAnnual) {
        const remainingAnnual = Math.max(0, maxAnnual - usedAnnual);
        return {
          valid: false,
          errorMsg: `Medical Leave Annual Quota Exceeded: You have used ${usedAnnual} of 24.0 annual Medical Leave days. Requesting ${reqDays} day(s) exceeds your remaining annual balance of ${remainingAnnual} day(s).`
        };
      }
    }

    return { valid: true };
  };

  // Form submission handler
  const handleSubmitRequest = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const isHalfDay = dayType === "AM" || dayType === "PM";
    const effectiveEndDate = isHalfDay ? startDate : endDate;

    if (!startDate || !effectiveEndDate) {
      setError(isHalfDay ? "Please specify the date." : "Please specify both start and end dates.");
      return;
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (startDate < todayStr) {
      setError("Start date cannot be before today's date.");
      return;
    }

    if (!isHalfDay && effectiveEndDate < startDate) {
      setError("End date cannot be before start date.");
      return;
    }

    const calculatedDays = getDaysDifference(startDate, effectiveEndDate);
    if (calculatedDays === 0) {
      setError("The selected date range contains only weekends or public holidays. Please select valid working days.");
      return;
    }

    if (!reason.trim()) {
      setError("Please provide a brief reason or notes for your request.");
      return;
    }

    // Check quota limit for selected leave type
    const quotaCheck = validateLeaveQuota(currentUserEmail, leaveType, startDate, effectiveEndDate, dayType);
    if (!quotaCheck.valid && quotaCheck.errorMsg) {
      setError(quotaCheck.errorMsg);
      return;
    }

    // Check for existing overlapping requests
    const overlapCheck = checkLeaveOverlap(currentUserEmail, startDate, effectiveEndDate, dayType);
    if (overlapCheck.hasOverlap && overlapCheck.overlappingRequest) {
      const overReq = overlapCheck.overlappingRequest;
      const portionStr = overReq.dayType && overReq.dayType !== "Full Day" ? ` (${overReq.dayType})` : "";
      setError(`Overlap Conflict: You have an existing ${overReq.leaveType}${portionStr} request from ${formatDateForDisplay(overReq.startDate)} to ${formatDateForDisplay(overReq.endDate)}.`);
      return;
    }

    setSubmitting(true);

    const cleanAttachments = (attachments || []).map(a => ({
      name: String(a.name || "Attachment"),
      url: String(a.url || ""),
      size: Number(a.size || 0),
      type: String(a.type || "application/octet-stream")
    }));

    const payload: Omit<LeaveRequest, "id" | "createdAt"> = {
      requestorEmail: currentUserEmail,
      requestorName: currentUserName,
      leaveType,
      startDate,
      endDate: effectiveEndDate,
      reason: reason.trim(),
      status: "Approved",
      dayType,
      attachments: cleanAttachments
    };

    try {
      if (isLive) {
        // 1. Write the leave request document into Firestore
        await leaveService.addLeaveRequest(payload);
      } else {
        // Offline handling
        const offlineId = `lr-off-${Date.now()}`;
        const newOfflineRequest: LeaveRequest = {
          id: offlineId,
          ...payload,
          createdAt: new Date().toISOString()
        };
        const updated = [newOfflineRequest, ...requests];
        setRequests(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }

      // Ping n8n webhook immediately after save is successful
      try {
        await fetch("https://n8n-z59x.srv1520583.hstgr.cloud/webhook/758e13ae-436b-472a-88ad-e35d1a29ed61", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employeeName: user?.name || currentUserName, // Employee Name
            employeeEmail: user?.email || currentUserEmail, // IMPORTANT: Employee Email
            requestorName: user?.name || currentUserName,
            requestorEmail: user?.email || currentUserEmail,
            leaveType: leaveType,
            startDate: startDate,
            endDate: effectiveEndDate,
            reason: reason.trim(),
            status: "Approved",
            dayType: dayType,
            daytype: dayType,
            leavetype: dayType,
            "AM/PM/All Day": dayType,
            "AM/PM/Full Day": dayType,
            durationDays: getDaysDifference(startDate, effectiveEndDate),
            leaveWeight: getDaysDifference(startDate, effectiveEndDate) * (dayType === "Full Day" ? 1.0 : 0.5),
            numberOfDays: getDaysDifference(startDate, effectiveEndDate) * (dayType === "Full Day" ? 1.0 : 0.5),
            numberofdays: getDaysDifference(startDate, effectiveEndDate) * (dayType === "Full Day" ? 1.0 : 0.5),
            action: "submit",
            adminEmails: ADMIN_EMAILS,
            adminEmailsStr: ADMIN_EMAILS.join(", ")
          }),
        });
        console.log("n8n Webhook pinged successfully!");
      } catch (error) {
        console.error("Error connecting to n8n:", error);
      }

      setSubmittedRequestDetails({
        leaveType,
        startDate,
        endDate: effectiveEndDate,
        notifiedAdmins: ADMIN_EMAILS,
        dayType
      });
      setShowSentConfirmation(true);
      setSuccess("Your leave has been registered and logged successfully.");

      setLeaveType("Annual Leave");
      setStartDate("");
      setEndDate("");
      setReason("");
      setDayType("Full Day");
      setAttachments([]);
      setFormOpen(false);
    } catch (err: any) {
      setError(err.message || "Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminSubmitLeave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!adminSelectedEmail) {
      setError("Please select an employee.");
      return;
    }

    const isAdminHalfDay = adminDayType === "AM" || adminDayType === "PM";
    const effectiveAdminEndDate = isAdminHalfDay ? adminStartDate : adminEndDate;

    if (!adminStartDate || !effectiveAdminEndDate) {
      setError(isAdminHalfDay ? "Please specify the date." : "Please specify both start and end dates.");
      return;
    }

    if (!isAdminHalfDay && new Date(adminStartDate) > new Date(effectiveAdminEndDate)) {
      setError("The start date must be on or before the end date.");
      return;
    }

    const calculatedAdminDays = getDaysDifference(adminStartDate, effectiveAdminEndDate);
    if (calculatedAdminDays === 0) {
      setError("The selected date range contains only weekends or public holidays. Please select valid working days.");
      return;
    }

    if (!adminReason.trim()) {
      setError("Please provide a reason or notes for this historical leave.");
      return;
    }

    // Check quota limit for selected leave type
    const quotaCheck = validateLeaveQuota(adminSelectedEmail, adminLeaveType, adminStartDate, effectiveAdminEndDate, adminDayType);
    if (!quotaCheck.valid && quotaCheck.errorMsg) {
      setError(quotaCheck.errorMsg);
      return;
    }

    const selectedMember = teamMembers.find(
      (m) => m.email.toLowerCase().trim() === adminSelectedEmail.toLowerCase().trim()
    );
    const employeeName = selectedMember ? selectedMember.name : adminSelectedEmail;

    // Check for existing overlapping requests
    const overlapCheck = checkLeaveOverlap(adminSelectedEmail, adminStartDate, effectiveAdminEndDate, adminDayType);
    if (overlapCheck.hasOverlap && overlapCheck.overlappingRequest) {
      const overReq = overlapCheck.overlappingRequest;
      const portionStr = overReq.dayType && overReq.dayType !== "Full Day" ? ` (${overReq.dayType})` : "";
      setError(`Overlap Conflict: ${employeeName} already has an existing ${overReq.leaveType}${portionStr} request from ${formatDateForDisplay(overReq.startDate)} to ${formatDateForDisplay(overReq.endDate)}.`);
      return;
    }

    setAdminSubmitting(true);

    const cleanAdminAttachments = (adminAttachments || []).map(a => ({
      name: String(a.name || "Attachment"),
      url: String(a.url || ""),
      size: Number(a.size || 0),
      type: String(a.type || "application/octet-stream")
    }));

    const payload: Omit<LeaveRequest, "id" | "createdAt"> = {
      requestorEmail: adminSelectedEmail.toLowerCase().trim(),
      requestorName: employeeName,
      leaveType: adminLeaveType,
      startDate: adminStartDate,
      endDate: effectiveAdminEndDate,
      reason: adminReason.trim() + " (Logged by Admin)",
      status: "Approved",
      dayType: adminDayType,
      attachments: cleanAdminAttachments
    };

    try {
      if (isLive) {
        await leaveService.addLeaveRequest(payload);
      } else {
        const offlineId = `lr-off-${Date.now()}`;
        const newOfflineRequest: LeaveRequest = {
          id: offlineId,
          ...payload,
          createdAt: new Date().toISOString()
        };
        const updated = [newOfflineRequest, ...requests];
        setRequests(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }

      try {
        await fetch("https://n8n-z59x.srv1520583.hstgr.cloud/webhook/758e13ae-436b-472a-88ad-e35d1a29ed61", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employeeName: employeeName,
            employeeEmail: adminSelectedEmail,
            requestorName: user?.name || currentUserName,
            requestorEmail: user?.email || currentUserEmail,
            leaveType: adminLeaveType,
            startDate: adminStartDate,
            endDate: effectiveAdminEndDate,
            reason: adminReason.trim() + " (Logged by Admin)",
            status: "Approved",
            dayType: adminDayType,
            daytype: adminDayType,
            leavetype: adminDayType,
            "AM/PM/All Day": adminDayType,
            "AM/PM/Full Day": adminDayType,
            durationDays: getDaysDifference(adminStartDate, effectiveAdminEndDate),
            leaveWeight: getDaysDifference(adminStartDate, effectiveAdminEndDate) * (adminDayType === "Full Day" ? 1.0 : 0.5),
            numberOfDays: getDaysDifference(adminStartDate, effectiveAdminEndDate) * (adminDayType === "Full Day" ? 1.0 : 0.5),
            numberofdays: getDaysDifference(adminStartDate, effectiveAdminEndDate) * (adminDayType === "Full Day" ? 1.0 : 0.5),
            action: "historical_log",
            adminEmails: ADMIN_EMAILS,
            adminEmailsStr: ADMIN_EMAILS.join(", ")
          }),
        });
        console.log("n8n Webhook pinged successfully for historical log!");
      } catch (error) {
        console.error("Error connecting to n8n:", error);
      }

      setSuccess(`Successfully logged historical leave for ${employeeName}.`);
      setAdminSelectedEmail("");
      setAdminLeaveType("Annual Leave");
      setAdminStartDate("");
      setAdminEndDate("");
      setAdminReason("");
      setAdminDayType("Full Day");
      setAdminAttachments([]);
      setAdminFormOpen(false);
    } catch (err: any) {
      setError(err.message || "Failed to log historical leave. Please try again.");
    } finally {
      setAdminSubmitting(false);
    }
  };

  // Status update handler (Approved/Denied) - kept for structural compatibility
  const handleUpdateStatus = async (requestId: string, newStatus: "Approved" | "Denied") => {
    setError(null);
    setSuccess(null);
    try {
      if (isLive) {
        await leaveService.updateLeaveStatus(requestId, newStatus);
      } else {
        // Offline update
        const updated = requests.map(req => {
          if (req.id === requestId) {
            return { ...req, status: newStatus };
          }
          return req;
        });
        setRequests(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }

      // Find updated request to send details to n8n webhook
      const leaveReq = requests.find(r => r.id === requestId);
      if (leaveReq) {
        try {
          await fetch("https://n8n-z59x.srv1520583.hstgr.cloud/webhook/758e13ae-436b-472a-88ad-e35d1a29ed61", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requestId: requestId,
              employeeName: leaveReq.requestorName || "Requestor",
              employeeEmail: leaveReq.requestorEmail || "",
              requestorName: leaveReq.requestorName || "Requestor",
              requestorEmail: leaveReq.requestorEmail || "",
              leaveType: leaveReq.leaveType,
              startDate: leaveReq.startDate,
              endDate: leaveReq.endDate,
              reason: leaveReq.reason || "",
              status: newStatus,
              action: "status_update",
              adminEmails: ADMIN_EMAILS,
              adminEmailsStr: ADMIN_EMAILS.join(", ")
            }),
          });
          console.log("n8n status update Webhook pinged successfully!");
        } catch (webhookErr) {
          console.error("Error sending status update to n8n:", webhookErr);
        }
      }

      setSuccess(`Request status updated to ${newStatus}.`);
    } catch (err: any) {
      setError(err.message || "Failed to update status.");
    }
  };

  // Lists filtered by user and sorted by most recent first
  const myRequests = requests
    .filter(req => req.requestorEmail?.toLowerCase().trim() === currentUserEmail.toLowerCase().trim())
    .sort((a, b) => {
      const dateA = a.startDate || "";
      const dateB = b.startDate || "";
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA); // most recent first
      }
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createdB - createdA;
    });

  const myApprovedLeaves = requests.filter(req => {
    if (req.requestorEmail?.toLowerCase().trim() !== currentUserEmail.toLowerCase().trim()) return false;
    if (req.status !== "Approved") return false;
    if (selectedLeaveYear !== "all") {
      const startYr = req.startDate ? req.startDate.substring(0, 4) : "";
      const endYr = req.endDate ? req.endDate.substring(0, 4) : "";
      return startYr === selectedLeaveYear || endYr === selectedLeaveYear;
    }
    return true;
  });

  const myLeavesWeight = myApprovedLeaves.reduce((sum, r) => {
    const daysCount = getDaysDifference(r.startDate, r.endDate);
    const isHalfDay = r.dayType === "AM" || r.dayType === "PM";
    return sum + (daysCount * (isHalfDay ? 0.5 : 1.0));
  }, 0);

  const calcTypeWeight = (typeMatch: (t: string) => boolean) => {
    return myApprovedLeaves.reduce((sum, r) => {
      if (!typeMatch(r.leaveType)) return sum;
      const daysCount = getDaysDifference(r.startDate, r.endDate);
      const isHalfDay = r.dayType === "AM" || r.dayType === "PM";
      return sum + (daysCount * (isHalfDay ? 0.5 : 1.0));
    }, 0);
  };

  const myAnnualLeavesWeight = calcTypeWeight(t => t === "Annual Leave");
  const myCasualLeavesWeight = calcTypeWeight(t => t === "Casual Leave" || t === "Urgent Leave");
  const myMedicalLeavesWeight = calcTypeWeight(t => t === "Medical Leave");

  const getUserLeaveBalances = (targetEmail: string) => {
    if (!targetEmail) {
      return { annualUsed: 0, casualUsed: 0, medicalUsed: 0 };
    }
    const currentYearStr = new Date().getFullYear().toString();
    const active = requests.filter(req => {
      if (req.requestorEmail?.toLowerCase().trim() !== targetEmail.toLowerCase().trim()) return false;
      if (req.status === "Denied") return false;
      const startYr = req.startDate ? req.startDate.substring(0, 4) : "";
      const endYr = req.endDate ? req.endDate.substring(0, 4) : "";
      return startYr === currentYearStr || endYr === currentYearStr;
    });

    const calcWeight = (matchFn: (t: string) => boolean) => {
      return active.reduce((sum, r) => {
        if (!matchFn(r.leaveType)) return sum;
        const daysCount = getDaysDifference(r.startDate, r.endDate);
        const isHalfDay = r.dayType === "AM" || r.dayType === "PM";
        return sum + (daysCount * (isHalfDay ? 0.5 : 1.0));
      }, 0);
    };

    const annualUsed = calcWeight(t => t === "Annual Leave");
    const casualUsed = calcWeight(t => t === "Casual Leave" || t === "Urgent Leave");
    const medicalUsed = calcWeight(t => t === "Medical Leave");

    return { annualUsed, casualUsed, medicalUsed };
  };

  const renderLeaveQuotaWidget = (
    email: string,
    options?: {
      titlePrefix?: string;
      showTitle?: boolean;
    }
  ) => {
    const bal = getUserLeaveBalances(email);
    const now = new Date();
    const selectedMember = teamMembers.find(m => m.email.toLowerCase().trim() === email?.toLowerCase().trim());
    const nameLabel = selectedMember?.name ? selectedMember.name : (options?.titlePrefix || "Your");

    const annualPct = Math.min(100, (bal.annualUsed / 10) * 100);
    const casualPct = Math.min(100, (bal.casualUsed / 6) * 100);
    const medicalPct = Math.min(100, (bal.medicalUsed / 24) * 100);

    return (
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-3">
        {options?.showTitle !== false && (
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/60 pb-2">
            <span className="flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-500 shrink-0" />
              {nameLabel === "Your" ? "Your Leave Allowances & Annual Balances" : `${nameLabel}'s Leave Allowances & Annual Balances`}
            </span>
            <span className="text-[10px] text-slate-400 font-mono font-medium">
              Year {now.getFullYear()}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Annual Leave */}
          <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Annual Leave</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border border-indigo-200/60 dark:border-indigo-800/40 font-mono shrink-0">
                {bal.annualUsed} / 10d
              </span>
            </div>
            
            {/* Visual Progress Bar */}
            <div className="w-full bg-indigo-100/80 dark:bg-indigo-950/80 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  annualPct >= 100 ? "bg-rose-500" : annualPct >= 80 ? "bg-amber-500" : "bg-indigo-600"
                }`}
                style={{ width: `${annualPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-indigo-700/90 dark:text-indigo-300 font-medium">
              <span>{Math.max(0, 10 - bal.annualUsed)}d remaining</span>
              <span className="opacity-75 font-mono">10.0d/yr limit</span>
            </div>
          </div>

          {/* Casual Leave */}
          <div className="p-3 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200">Casual Leave</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-200/60 dark:border-amber-800/40 font-mono shrink-0">
                {bal.casualUsed} / 6d
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-amber-100/80 dark:bg-amber-950/80 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  casualPct >= 100 ? "bg-rose-500" : casualPct >= 80 ? "bg-amber-600" : "bg-amber-500"
                }`}
                style={{ width: `${casualPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-amber-700/90 dark:text-amber-300 font-medium">
              <span>{bal.casualUsed >= 6 ? "Limit reached" : `${Math.max(0, 6 - bal.casualUsed)}d remaining`}</span>
              <span className="opacity-75 font-mono">6.0d/yr limit</span>
            </div>
          </div>

          {/* Medical Leave */}
          <div className="p-3 bg-teal-50/50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/40 rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-teal-900 dark:text-teal-200">Medical Leave</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 text-teal-800 dark:bg-teal-900/80 dark:text-teal-200 border border-teal-200/80 dark:border-teal-800/60 font-mono shrink-0">
                {bal.medicalUsed} / 24d
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-teal-100/80 dark:bg-teal-950/80 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  medicalPct >= 100 ? "bg-rose-500" : medicalPct >= 80 ? "bg-amber-500" : "bg-teal-500"
                }`}
                style={{ width: `${medicalPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-teal-700/90 dark:text-teal-300 font-medium">
              <span>{Math.max(0, 24 - bal.medicalUsed)}d remaining</span>
              <span className="opacity-85 font-mono">24.0d/yr limit</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Filter and sort history requests by most recent first
  const filteredHistoryRequests = requests
    .filter(req => {
      if (selectedEmployeeEmail !== "all" && req.requestorEmail?.toLowerCase().trim() !== selectedEmployeeEmail.toLowerCase().trim()) {
        return false;
      }
      if (selectedHistoryLeaveType !== "all" && req.leaveType !== selectedHistoryLeaveType) {
        return false;
      }
      if (selectedHistoryStatus !== "all" && req.status !== selectedHistoryStatus) {
        return false;
      }
      if (selectedHistoryYear !== "all") {
        const startYr = req.startDate ? req.startDate.substring(0, 4) : "";
        const endYr = req.endDate ? req.endDate.substring(0, 4) : "";
        if (startYr !== selectedHistoryYear && endYr !== selectedHistoryYear) {
          return false;
        }
      }
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase().trim();
        const nameMatch = req.requestorName?.toLowerCase().includes(q);
        const emailMatch = req.requestorEmail?.toLowerCase().includes(q);
        const reasonMatch = req.reason?.toLowerCase().includes(q);
        const typeMatch = req.leaveType?.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !reasonMatch && !typeMatch) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = a.startDate || "";
      const dateB = b.startDate || "";
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA); // most recent first
      }
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createdB - createdA;
    });

  const myFilteredRequests = myRequests.filter(req => {
    if (selectedHistoryLeaveType !== "all" && req.leaveType !== selectedHistoryLeaveType) {
      return false;
    }
    if (selectedHistoryStatus !== "all" && req.status !== selectedHistoryStatus) {
      return false;
    }
    if (selectedHistoryYear !== "all") {
      const startYr = req.startDate ? req.startDate.substring(0, 4) : "";
      const endYr = req.endDate ? req.endDate.substring(0, 4) : "";
      if (startYr !== selectedHistoryYear && endYr !== selectedHistoryYear) {
        return false;
      }
    }
    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase().trim();
      const reasonMatch = req.reason?.toLowerCase().includes(q);
      const typeMatch = req.leaveType?.toLowerCase().includes(q);
      if (!reasonMatch && !typeMatch) {
        return false;
      }
    }
    return true;
  });

  // Export filtered leave requests to CSV spreadsheet file
  const handleExportCSV = () => {
    const listToExport = activeHistoryTab === "team-history" ? filteredHistoryRequests : myFilteredRequests;
    if (listToExport.length === 0) {
      setError("No leave requests found matching the current filters to export.");
      setTimeout(() => setError(null), 4000);
      return;
    }

    // Exact format requested:
    // Name, Leave Type, Start Date, End Date, Reason, AM/PM/Full Day, Working Days
    const headers = [
      "Name",
      "Leave Type",
      "Start Date",
      "End Date",
      "Reason",
      "AM/PM/Full Day",
      "Working Days"
    ];

    const escapeCSV = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const formatCSVDate = (dateVal: any): string => {
      if (!dateVal) return "";
      let dateStr = "";
      if (typeof dateVal === "string") {
        dateStr = dateVal.split("T")[0];
      } else if (dateVal.toDate && typeof dateVal.toDate === "function") {
        dateStr = dateVal.toDate().toISOString().split("T")[0];
      } else if (dateVal.seconds) {
        dateStr = new Date(dateVal.seconds * 1000).toISOString().split("T")[0];
      } else if (dateVal instanceof Date) {
        dateStr = dateVal.toISOString().split("T")[0];
      } else {
        dateStr = String(dateVal);
      }

      try {
        const parts = dateStr.split("-");
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          const d = new Date(year, month, day);
          return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        }
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        }
        return dateStr;
      } catch {
        return dateStr;
      }
    };

    const rows = listToExport.map(req => {
      const rawStartStr = typeof req.startDate === "string" ? req.startDate.split("T")[0] : req.startDate;
      const rawEndStr = typeof req.endDate === "string" ? req.endDate.split("T")[0] : (req.endDate || rawStartStr);
      const rawDays = getDaysDifference(rawStartStr, rawEndStr);
      const isHalfDay = req.dayType === "AM" || req.dayType === "PM";
      const weight = rawDays * (isHalfDay ? 0.5 : 1.0);

      const startDateFormatted = formatCSVDate(req.startDate);
      const endDateFormatted = formatCSVDate(req.endDate || req.startDate);
      const dayTypeLabel = req.dayType || "Full Day";

      return [
        escapeCSV(req.requestorName || ""),
        escapeCSV(req.leaveType || ""),
        escapeCSV(startDateFormatted),
        escapeCSV(endDateFormatted),
        escapeCSV(req.reason || ""),
        escapeCSV(dayTypeLabel),
        escapeCSV(weight)
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.map(h => `"${h}"`).join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    
    let filterSuffix = "";
    if (activeHistoryTab === "team-history") {
      if (selectedEmployeeEmail !== "all") {
        filterSuffix += `_${selectedEmployeeEmail.split("@")[0]}`;
      }
    } else {
      filterSuffix += "_my_leaves";
    }
    if (selectedHistoryLeaveType !== "all") {
      filterSuffix += `_${selectedHistoryLeaveType.replace(/\s+/g, "_").toLowerCase()}`;
    }
    if (selectedHistoryStatus !== "all") {
      filterSuffix += `_${selectedHistoryStatus.toLowerCase()}`;
    }
    if (selectedHistoryYear !== "all") {
      filterSuffix += `_${selectedHistoryYear}`;
    }

    link.setAttribute("href", url);
    link.setAttribute("download", `codebyte_leave_history${filterSuffix}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setCsvDownloadSuccess(`Successfully exported ${listToExport.length} leave record${listToExport.length > 1 ? "s" : ""} to CSV spreadsheet!`);
    setTimeout(() => {
      setCsvDownloadSuccess(null);
    }, 4500);
  };

  // Leave style mapping helper
  const getLeaveTypeStyles = (type: LeaveType) => {
    switch (type) {
      case "Annual Leave":
        return {
          bg: "bg-indigo-50/80 dark:bg-indigo-950/20",
          text: "text-indigo-700 dark:text-indigo-400",
          border: "border-indigo-100 dark:border-indigo-900/40",
          badge: "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300"
        };
      case "Casual Leave":
        return {
          bg: "bg-amber-50/80 dark:bg-amber-950/20",
          text: "text-amber-700 dark:text-amber-400",
          border: "border-amber-100 dark:border-amber-900/40",
          badge: "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300"
        };
      case "Medical Leave":
        return {
          bg: "bg-teal-50/80 dark:bg-teal-950/20",
          text: "text-teal-700 dark:text-teal-400",
          border: "border-teal-100 dark:border-teal-900/40",
          badge: "bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300"
        };
      case "Urgent Leave":
        return {
          bg: "bg-purple-50/80 dark:bg-purple-950/20",
          text: "text-purple-700 dark:text-purple-400",
          border: "border-purple-100 dark:border-purple-900/40",
          badge: "bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300"
        };
      case "Unpaid Leave":
        return {
          bg: "bg-rose-50/80 dark:bg-rose-950/20",
          text: "text-rose-700 dark:text-rose-400",
          border: "border-rose-100 dark:border-rose-900/40",
          badge: "bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300"
        };
      default:
        return {
          bg: "bg-slate-50/80 dark:bg-slate-900/20",
          text: "text-slate-700 dark:text-slate-400",
          border: "border-slate-100 dark:border-slate-800/40",
          badge: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300"
        };
    }
  };

  const renderAvatar = (email: string, sizeClass = "w-6 h-6 text-[8px] font-extrabold") => {
    const initials = email.substring(0, 2).toUpperCase();
    return (
      <div className={`${sizeClass} rounded-full bg-slate-900 text-white flex items-center justify-center font-mono shrink-0`}>
        {initials}
      </div>
    );
  };

  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const formatDateWithDayOfWeek = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
      }
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  // Calendar calculations
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(prev => prev - 1);
    } else {
      setCalMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(prev => prev + 1);
    } else {
      setCalMonth(prev => prev + 1);
    }
  };

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDayIndex = getFirstDayOfMonth(calYear, calMonth);
  const prevMonthDays = calMonth === 0 ? getDaysInMonth(calYear - 1, 11) : getDaysInMonth(calYear, calMonth - 1);

  const calendarCells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Trailing days from prev month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const prevMonth = calMonth === 0 ? 11 : calMonth - 1;
    const prevYear = calMonth === 0 ? calYear - 1 : calYear;
    const day = prevMonthDays - i;
    const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    calendarCells.push({ dateStr, dayNum: day, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calendarCells.push({ dateStr, dayNum: d, isCurrentMonth: true });
  }

  // Leading days of next month to make 42 cells (6-week grid)
  let nextMonthDay = 1;
  while (calendarCells.length < 42) {
    const nextMonth = calMonth === 11 ? 0 : calMonth + 1;
    const nextYear = calMonth === 11 ? calYear + 1 : calYear;
    const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(nextMonthDay).padStart(2, "0")}`;
    calendarCells.push({ dateStr, dayNum: nextMonthDay, isCurrentMonth: false });
    nextMonthDay++;
  }

  const getApprovedLeavesForDate = (dateStr: string) => {
    return requests.filter(req => {
      if (req.status !== "Approved") return false;
      return req.startDate <= dateStr && req.endDate >= dateStr;
    });
  };

  const leavesOnSelectedDate = getApprovedLeavesForDate(selectedCalDate);

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 flex-1 max-w-7xl mx-auto w-full">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <CalendarIcon className="w-7 h-7 text-slate-900" />
            Leave Requests Portal
            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider border ${
              isAdmin 
                ? "bg-amber-100 text-amber-800 border-amber-200" 
                : "bg-slate-100 text-slate-700 border-slate-200"
            }`}>
              {isAdmin ? "Admin Mode" : "Member Mode"}
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Request time-off, monitor scheduled leaves on the team calendar, and check historical logs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsPolicyModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 px-3.5 py-2.5 rounded-xl text-sm font-bold shadow-2xs transition shrink-0 cursor-pointer"
            title="View Official CodeByte Leave Policy (Doc ID: Cod/POL/01)"
          >
            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Leave Policy</span>
            <span className="text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.2 rounded font-bold ml-0.5">PDF</span>
          </button>
          {isAdmin && (
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-3.5 py-2.5 rounded-xl text-sm font-bold shadow-2xs transition shrink-0 cursor-pointer"
              title="Download Filtered Leave History CSV Spreadsheet"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Download CSV</span>
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => {
                setSuccess(null);
                setError(null);
                setFormOpen(false);
                const nextState = !adminFormOpen;
                setAdminFormOpen(nextState);
                if (nextState) {
                  setTimeout(() => {
                    adminFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 100);
                }
              }}
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition shrink-0 cursor-pointer"
            >
              {adminFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {adminFormOpen ? "Close Log Form" : "Log Historical Leave"}
            </button>
          )}
          <button
            onClick={() => {
              setSuccess(null);
              setError(null);
              setAdminFormOpen(false);
              setShowSentConfirmation(false);
              const nextState = !formOpen;
              setFormOpen(nextState);
              if (nextState) {
                setTimeout(() => {
                  formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
              }
            }}
            className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition shrink-0 cursor-pointer"
          >
            {formOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {formOpen ? "Close Form" : "Request Leave"}
          </button>
        </div>
      </div>

      {/* CodeByte Leave Policy & Guidelines Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-indigo-900/50 flex flex-wrap items-center justify-between gap-4 animate-fade-in relative overflow-hidden">
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 rounded-xl shrink-0 shadow-inner">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                CodeByte Employee Attendance, Working Hours & Leave Policy
              </h3>
              <span className="text-[10px] font-mono font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                Doc ID: Cod/POL/01
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>⏰ Working Hours: <strong>9:00 AM – 5:00 PM (Mon–Fri)</strong></span>
              <span>•</span>
              <span>🏖️ Annual: <strong>10 Days</strong></span>
              <span>•</span>
              <span>⚡ Casual: <strong>6 Days</strong></span>
              <span>•</span>
              <span>🩺 Medical: <strong>24 Days</strong></span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 w-full sm:w-auto justify-end">
          <button
            onClick={() => setIsPolicyModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Info className="w-4 h-4 text-indigo-300" />
            <span>Read Full Policy</span>
          </button>

          <button
            onClick={() => generateCodeBytePolicyPdf()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            title="Download PDF Document"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-300 p-4 rounded-xl flex items-start gap-3 text-sm animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="font-medium">{error}</div>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl flex items-start gap-3 text-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="font-medium">{success}</div>
        </div>
      )}

      {/* Active User Leave Allowances & Balances Header Card */}
      {currentUserEmail && renderLeaveQuotaWidget(currentUserEmail, { showTitle: true })}

      {(myCasualLeavesWeight >= 5 || myAnnualLeavesWeight >= 8 || myMedicalLeavesWeight >= 20) && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/10 text-amber-800 dark:text-amber-300 p-4 rounded-xl flex items-start gap-3 text-sm animate-fade-in shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Leave Allowance Alert</div>
            <p className="text-xs text-amber-700/90 dark:text-amber-400/90 leading-relaxed">
              {myCasualLeavesWeight >= 5 && (
                <span className="block">Casual Leave: <strong>{myCasualLeavesWeight} / 6.0 days</strong> logged.{myCasualLeavesWeight >= 6 ? " Casual leave quota exhausted!" : " Close to 6-day limit."}</span>
              )}
              {myAnnualLeavesWeight >= 8 && (
                <span className="block">Annual Leave: <strong>{myAnnualLeavesWeight} / 10.0 days</strong> logged.{myAnnualLeavesWeight >= 10 ? " Annual leave quota exhausted!" : " Close to 10-day limit."}</span>
              )}
              {myMedicalLeavesWeight >= 20 && (
                <span className="block">Medical Leave: <strong>{myMedicalLeavesWeight} / 24.0 days</strong> logged (2 days/month guideline).</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Sent Confirmation Visual State */}
      {showSentConfirmation && submittedRequestDetails && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50/45 dark:bg-emerald-950/20 border-2 border-emerald-500/30 dark:border-emerald-500/25 p-6 rounded-2xl shadow-md max-w-xl animate-fade-in space-y-5"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
              <Send className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                Leave Request Sent Successfully!
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All relevant administrators have been instantly notified via our Gmail integration.
              </p>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/40 border border-slate-100/80 dark:border-slate-800/60 rounded-xl p-4 space-y-3 shadow-2xs">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Request Overview
            </h3>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="block text-slate-400 dark:text-slate-500 font-semibold mb-0.5">Leave Type</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <span className={`w-2 h-2 rounded-full ${
                    submittedRequestDetails.leaveType === "Annual Leave" ? "bg-indigo-500" :
                    submittedRequestDetails.leaveType === "Medical Leave" ? "bg-teal-500" :
                    submittedRequestDetails.leaveType === "Urgent Leave" ? "bg-amber-500" : "bg-rose-500"
                  }`}></span>
                  {submittedRequestDetails.leaveType}
                </span>
              </div>
              <div>
                <span className="block text-slate-400 dark:text-slate-500 font-semibold mb-0.5">Portion of Day</span>
                <span className="font-bold text-indigo-700 bg-indigo-50/70 border border-indigo-100 px-2 py-0.5 rounded-md inline-block">
                  {submittedRequestDetails.dayType || "Full Day"}
                </span>
              </div>
              <div>
                <span className="block text-slate-400 dark:text-slate-500 font-semibold mb-0.5">Timeline</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {formatDateForDisplay(submittedRequestDetails.startDate)} - {formatDateForDisplay(submittedRequestDetails.endDate)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
              <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Admins Notified via Automated Email Delivery:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {submittedRequestDetails.notifiedAdmins.map((email, idx) => (
                <div 
                  key={idx}
                  className="inline-flex items-center gap-1.5 bg-emerald-500/15 dark:bg-emerald-500/10 border border-emerald-500/25 dark:border-emerald-500/20 px-2.5 py-1 rounded-lg text-emerald-800 dark:text-emerald-300 font-mono text-[10px] font-bold"
                >
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                  {email}
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                </div>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-slate-400 dark:text-slate-400 italic bg-slate-50/50 dark:bg-slate-900/20 p-2.5 rounded-lg border border-slate-100/85 dark:border-slate-800/40">
            <strong>System Synced:</strong> The leave request is logged in Google Firestore, appended to the shared Google Spreadsheet, and dispatched through the Gmail integration to guarantee full office visibility.
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                setShowSentConfirmation(false);
                setSubmittedRequestDetails(null);
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              Acknowledge & Close
            </button>
          </div>
        </motion.div>
      )}

      {/* Leave Request Form */}
      {formOpen && (
        <div ref={formRef} className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-md max-w-xl animate-fade-in">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
            <CalendarIcon className="w-5 h-5 text-slate-500" />
            New Leave Request
          </h2>

          {/* Employee Current Leave Balances Widget */}
          <div className="mb-4">
            {renderLeaveQuotaWidget(currentUserEmail, { showTitle: false })}
          </div>

          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Leave Type
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
              >
                <option value="Annual Leave">Annual Leave (10 days max/yr)</option>
                <option value="Casual Leave">Casual Leave (6 days max/yr)</option>
                <option value="Medical Leave">Medical Leave (24 days max/yr)</option>
                <option value="Unpaid Leave">Unpaid Leave</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Duration / Portion of Day
              </label>
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-150/50">
                {(["Full Day", "AM", "PM"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setDayType(option);
                      if (option !== "Full Day" && startDate) {
                        setEndDate(startDate);
                      }
                    }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      dayType === option
                        ? "bg-white text-slate-900 border border-slate-200 shadow-xs"
                        : "text-slate-500 hover:text-slate-850"
                    }`}
                  >
                    {option === "Full Day" ? "Full Day" : option === "AM" ? "AM (Half)" : "PM (Half)"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={dayType !== "Full Day" ? "sm:col-span-2" : ""}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {dayType !== "Full Day" ? "Date" : "Start Date"}
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Holidays auto-excluded</span>
                </div>
                <input
                  type="date"
                  min={new Date().toLocaleDateString("en-CA")}
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (dayType !== "Full Day") {
                      setEndDate(e.target.value);
                    }
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 transition shadow-2xs ${
                    startDate && getBurmeseHoliday(startDate)
                      ? "border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/20 bg-amber-50/20"
                      : "border-slate-200 focus:ring-indigo-500"
                  }`}
                  required
                />
                {startDate && (() => {
                  const h = getBurmeseHoliday(startDate);
                  const isWknd = (() => {
                    const d = new Date(startDate);
                    return d.getDay() === 0 || d.getDay() === 6;
                  })();

                  if (h) {
                    return (
                      <div className="mt-1 px-2.5 py-1 rounded-md bg-amber-50/90 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-800/80 text-amber-900 dark:text-amber-100 text-[11px] font-bold flex items-center justify-between animate-fade-in shadow-2xs">
                        <span className="flex items-center gap-1.5 truncate">
                          <span>🇲🇲</span>
                          <span className="truncate">{h.nameEn} ({h.nameMm})</span>
                        </span>
                        <span className="text-[10px] font-extrabold text-amber-800 dark:text-amber-300 shrink-0 ml-1">0 Days</span>
                      </div>
                    );
                  }

                  if (isWknd) {
                    return (
                      <div className="mt-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center justify-between animate-fade-in">
                        <span className="flex items-center gap-1.5">
                          <span>🗓️</span>
                          <span>Weekend (Sat/Sun)</span>
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 shrink-0">0 Days</span>
                      </div>
                    );
                  }

                  return null;
                })()}
              </div>

              {dayType === "Full Day" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      End Date
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">Holidays auto-excluded</span>
                  </div>
                  <input
                    type="date"
                    min={startDate || new Date().toLocaleDateString("en-CA")}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 transition shadow-2xs ${
                      endDate && getBurmeseHoliday(endDate)
                        ? "border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/20 bg-amber-50/20"
                        : "border-slate-200 focus:ring-indigo-500"
                    }`}
                    required
                  />
                  {endDate && endDate !== startDate && (() => {
                    const h = getBurmeseHoliday(endDate);
                    const isWknd = (() => {
                      const d = new Date(endDate);
                      return d.getDay() === 0 || d.getDay() === 6;
                    })();

                    if (h) {
                      return (
                        <div className="mt-1 px-2.5 py-1 rounded-md bg-amber-50/90 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-800/80 text-amber-900 dark:text-amber-100 text-[11px] font-bold flex items-center justify-between animate-fade-in shadow-2xs">
                          <span className="flex items-center gap-1.5 truncate">
                            <span>🇲🇲</span>
                            <span className="truncate">{h.nameEn} ({h.nameMm})</span>
                          </span>
                          <span className="text-[10px] font-extrabold text-amber-800 dark:text-amber-300 shrink-0 ml-1">0 Days</span>
                        </div>
                      );
                    }

                    if (isWknd) {
                      return (
                        <div className="mt-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center justify-between animate-fade-in">
                          <span className="flex items-center gap-1.5">
                            <span>🗓️</span>
                            <span>Weekend (Sat/Sun)</span>
                          </span>
                          <span className="text-[10px] font-medium text-slate-500 shrink-0">0 Days</span>
                        </div>
                      );
                    }

                    return null;
                  })()}
                </div>
              )}
            </div>

            {/* Unified Leave Impact & Coverage Summary Card */}
            {startDate && (dayType !== "Full Day" || endDate) && (() => {
              const isHalfDay = dayType === "AM" || dayType === "PM";
              const effectiveEndDate = isHalfDay ? startDate : endDate;
              const rawDays = getDaysDifference(startDate, effectiveEndDate);
              const weight = rawDays * (isHalfDay ? 0.5 : 1.0);
              const overlappingHolidays = getBurmeseHolidaysInRange(startDate, effectiveEndDate);
              const overlaps = getTeamOverlapsForRange(currentUserEmail, startDate, effectiveEndDate);
              
              const totalTeam = teamMembers.length || 1;
              const awayEmails = new Set(overlaps.map(o => o.requestorEmail?.toLowerCase().trim()));
              const awayCount = awayEmails.size;
              const availableCount = Math.max(0, totalTeam - awayCount);
              const capacityPct = Math.round((availableCount / totalTeam) * 100);

              return (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-xl space-y-2.5 animate-fade-in shadow-2xs">
                  {/* Row 1: Calculated Duration */}
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      Calculated Duration:
                    </span>
                    {rawDays === 0 ? (
                      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-extrabold bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        0 Days (Weekend / Public Holiday)
                      </span>
                    ) : (
                      <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm font-mono">
                        {weight} {weight === 1 ? "working day" : "working days"}
                      </span>
                    )}
                  </div>

                  {/* Row 2: Overlapping Public Holidays Notice (if any) */}
                  {overlappingHolidays.length > 0 && (
                    <div className="p-2 bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs text-amber-900 dark:text-amber-200 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[11px]">
                        <span>🇲🇲</span>
                        <span>Overlaps with {overlappingHolidays.length} Public Holiday{overlappingHolidays.length > 1 ? "s" : ""}:</span>
                      </div>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {overlappingHolidays.map((h) => (
                          <span key={h.dateStr} className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100 font-medium rounded text-[10px] border border-amber-300/60 dark:border-amber-700/60">
                            <strong>{h.holiday.nameEn}</strong> ({formatDateForDisplay(h.dateStr)}) — <span className="font-semibold text-emerald-700 dark:text-emerald-400">0 Day Deduction</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Row 3: Team Overlap & Capacity Alert (if any) */}
                  {overlaps.length > 0 && (
                    <div className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${
                      capacityPct < 60 
                        ? "bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200"
                        : "bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200"
                    }`}>
                      <div className="flex items-center justify-between gap-2 font-bold text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <ShieldAlert className={`w-3.5 h-3.5 ${capacityPct < 60 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`} />
                          <span>Team Overlap Alert: {awayCount} member{awayCount > 1 ? "s" : ""} away</span>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-extrabold ${
                          capacityPct < 60 ? "bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100" : "bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100"
                        }`}>
                          {capacityPct}% Capacity
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
                        {Array.from(awayEmails).map(email => {
                          const member = teamMembers.find(m => m.email.toLowerCase().trim() === email);
                          return (
                            <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/90 dark:bg-slate-900/80 rounded border border-slate-200 dark:border-slate-800 text-[10px] font-bold">
                              {renderAvatar(email, "w-3.5 h-3.5 text-[7px]")}
                              <span>{member?.name || email}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Reason / Notes
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Describe the reason for your time-off request..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                required
              />
            </div>

            {/* Medical Records & Document Attachments Upload */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                  {leaveType === "Medical Leave" ? "Medical Record / Doctor's Note Attachment" : "Attachments / Documents (Optional)"}
                </span>
                {leaveType === "Medical Leave" && (
                  <span className="text-[10px] text-teal-700 dark:text-teal-300 font-extrabold uppercase bg-teal-50 dark:bg-teal-950/80 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                    Recommended for Medical Records
                  </span>
                )}
              </label>

              <div className="space-y-2">
                <label className={`flex flex-col items-center justify-center p-3.5 border-2 border-dashed rounded-xl cursor-pointer transition ${
                  leaveType === "Medical Leave"
                    ? "border-teal-300 dark:border-teal-700 bg-teal-50/40 dark:bg-teal-950/30 hover:bg-teal-50/80 dark:hover:bg-teal-950/50"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/80"
                }`}>
                  <div className="flex flex-col items-center text-center gap-1">
                    <Upload className={`w-5 h-5 ${leaveType === "Medical Leave" ? "text-teal-600 dark:text-teal-400" : "text-slate-400"}`} />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Click to upload medical certificate, doctor's note, or attachment
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      PDF, PNG, JPG, DOCX (Max 8MB)
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    multiple
                    onChange={(e) => handleFileChange(e, "normal")}
                    className="hidden"
                  />
                </label>

                {attachments.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{att.name}</span>
                          {att.size && (
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">
                              ({(att.size / 1024).toFixed(0)} KB)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={att.name}
                            className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                            title="View/Download Attachment"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Remove File"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-55 cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Request
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Log Historical Leave Form (Admin-Only) */}
      {isAdmin && adminFormOpen && (
        <div ref={adminFormRef} className="bg-white p-6 rounded-2xl border border-indigo-200 shadow-md max-w-xl animate-fade-in">
          <h2 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2 border-b border-indigo-50 pb-2">
            <CalendarIcon className="w-5 h-5 text-indigo-600" />
            Log Historical Leave (Admin)
          </h2>
          <form onSubmit={handleAdminSubmitLeave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Select Employee
              </label>
              <select
                value={adminSelectedEmail}
                onChange={(e) => setAdminSelectedEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
                required
              >
                <option value="">-- Choose Employee --</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.email}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Employee Leave Balances Widget */}
            {adminSelectedEmail ? (
              <div className="mb-4">
                {renderLeaveQuotaWidget(adminSelectedEmail, { showTitle: true, titlePrefix: "Employee" })}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 text-xs text-slate-500 flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Select an employee above to inspect their current annual, casual, and medical balances.</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Leave Type
              </label>
              <select
                value={adminLeaveType}
                onChange={(e) => setAdminLeaveType(e.target.value as LeaveType)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
              >
                <option value="Annual Leave">Annual Leave (10 days max/yr)</option>
                <option value="Casual Leave">Casual Leave (6 days max/yr)</option>
                <option value="Medical Leave">Medical Leave (24 days max/yr)</option>
                <option value="Unpaid Leave">Unpaid Leave</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Duration / Portion of Day
              </label>
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-150/50">
                {(["Full Day", "AM", "PM"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setAdminDayType(option);
                      if (option !== "Full Day" && adminStartDate) {
                        setAdminEndDate(adminStartDate);
                      }
                    }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      adminDayType === option
                        ? "bg-indigo-600 text-white border border-transparent shadow-xs"
                        : "text-slate-650 hover:text-slate-900"
                    }`}
                  >
                    {option === "Full Day" ? "Full Day" : option === "AM" ? "AM (Half)" : "PM (Half)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Selection Legend Bar */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-500" />
                  Date Selector Color Legend
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Auto-Calculated</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100/90 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 font-bold shadow-2xs" title="Official Gazetted Public Holidays do not deduct from annual leave allowance">
                  <span>🇲🇲</span>
                  <span>Public Holiday</span>
                  <span className="ml-0.5 px-1 bg-amber-200/80 dark:bg-amber-900 text-amber-950 dark:text-amber-100 rounded text-[9px]">0 Days</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700 font-bold shadow-2xs" title="Saturdays and Sundays are non-working weekend days">
                  <span>🗓️</span>
                  <span>Weekend</span>
                  <span className="ml-0.5 px-1 bg-slate-300/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded text-[9px]">0 Days</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-300/80 dark:border-emerald-700/80 font-bold shadow-2xs" title="Standard company working days consume leave quota">
                  <span>💼</span>
                  <span>Working Day</span>
                  <span className="ml-0.5 px-1 bg-emerald-200/80 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-100 rounded text-[9px]">1.0 / 0.5 Day</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={adminDayType !== "Full Day" ? "sm:col-span-2" : ""}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {adminDayType !== "Full Day" ? "Date" : "Start Date"}
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Holidays auto-excluded</span>
                </div>
                <input
                  type="date"
                  value={adminStartDate}
                  onChange={(e) => {
                    setAdminStartDate(e.target.value);
                    if (adminDayType !== "Full Day") {
                      setAdminEndDate(e.target.value);
                    }
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 transition shadow-2xs ${
                    adminStartDate && getBurmeseHoliday(adminStartDate)
                      ? "border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/20 bg-amber-50/20"
                      : "border-slate-200 focus:ring-indigo-500"
                  }`}
                  required
                />
                {adminStartDate && (() => {
                  const h = getBurmeseHoliday(adminStartDate);
                  const isWknd = (() => {
                    const d = new Date(adminStartDate);
                    return d.getDay() === 0 || d.getDay() === 6;
                  })();

                  if (h) {
                    return (
                      <div className="mt-1 px-2.5 py-1 rounded-md bg-amber-50/90 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-800/80 text-amber-900 dark:text-amber-100 text-[11px] font-bold flex items-center justify-between animate-fade-in shadow-2xs">
                        <span className="flex items-center gap-1.5 truncate">
                          <span>🇲🇲</span>
                          <span className="truncate">{h.nameEn} ({h.nameMm})</span>
                        </span>
                        <span className="text-[10px] font-extrabold text-amber-800 dark:text-amber-300 shrink-0 ml-1">0 Days</span>
                      </div>
                    );
                  }

                  if (isWknd) {
                    return (
                      <div className="mt-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center justify-between animate-fade-in">
                        <span className="flex items-center gap-1.5">
                          <span>🗓️</span>
                          <span>Weekend (Sat/Sun)</span>
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 shrink-0">0 Days</span>
                      </div>
                    );
                  }

                  return null;
                })()}
              </div>

              {adminDayType === "Full Day" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      End Date
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">Holidays auto-excluded</span>
                  </div>
                  <input
                    type="date"
                    value={adminEndDate}
                    onChange={(e) => setAdminEndDate(e.target.value)}
                    className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 transition shadow-2xs ${
                      adminEndDate && getBurmeseHoliday(adminEndDate)
                        ? "border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/20 bg-amber-50/20"
                        : "border-slate-200 focus:ring-indigo-500"
                    }`}
                    required
                  />
                  {adminEndDate && adminEndDate !== adminStartDate && (() => {
                    const h = getBurmeseHoliday(adminEndDate);
                    const isWknd = (() => {
                      const d = new Date(adminEndDate);
                      return d.getDay() === 0 || d.getDay() === 6;
                    })();

                    if (h) {
                      return (
                        <div className="mt-1 px-2.5 py-1 rounded-md bg-amber-50/90 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-800/80 text-amber-900 dark:text-amber-100 text-[11px] font-bold flex items-center justify-between animate-fade-in shadow-2xs">
                          <span className="flex items-center gap-1.5 truncate">
                            <span>🇲🇲</span>
                            <span className="truncate">{h.nameEn} ({h.nameMm})</span>
                          </span>
                          <span className="text-[10px] font-extrabold text-amber-800 dark:text-amber-300 shrink-0 ml-1">0 Days</span>
                        </div>
                      );
                    }

                    if (isWknd) {
                      return (
                        <div className="mt-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center justify-between animate-fade-in">
                          <span className="flex items-center gap-1.5">
                            <span>🗓️</span>
                            <span>Weekend (Sat/Sun)</span>
                          </span>
                          <span className="text-[10px] font-medium text-slate-500 shrink-0">0 Days</span>
                        </div>
                      );
                    }

                    return null;
                  })()}
                </div>
              )}
            </div>

            {/* Unified Leave Impact Summary for Admin Form */}
            {adminStartDate && (adminDayType !== "Full Day" || adminEndDate) && (() => {
              const isAdminHalfDay = adminDayType === "AM" || adminDayType === "PM";
              const effectiveAdminEndDate = isAdminHalfDay ? adminStartDate : adminEndDate;
              const rawDays = getDaysDifference(adminStartDate, effectiveAdminEndDate);
              const weight = rawDays * (isAdminHalfDay ? 0.5 : 1.0);
              const overlappingHolidays = getBurmeseHolidaysInRange(adminStartDate, effectiveAdminEndDate);

              return (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-xl space-y-2 animate-fade-in shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      Calculated Leave Duration:
                    </span>
                    {rawDays === 0 ? (
                      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-extrabold bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        0 Days (Weekend / Public Holiday)
                      </span>
                    ) : (
                      <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm font-mono">
                        {weight} {weight === 1 ? "working day" : "working days"}
                      </span>
                    )}
                  </div>

                  {overlappingHolidays.length > 0 && (
                    <div className="p-2 bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs text-amber-900 dark:text-amber-200 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[11px]">
                        <span>🇲🇲</span>
                        <span>Overlaps with {overlappingHolidays.length} Public Holiday{overlappingHolidays.length > 1 ? "s" : ""}:</span>
                      </div>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {overlappingHolidays.map((h) => (
                          <span key={h.dateStr} className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100 font-medium rounded text-[10px] border border-amber-300/60 dark:border-amber-700/60">
                            <strong>{h.holiday.nameEn}</strong> ({formatDateForDisplay(h.dateStr)}) — <span className="font-semibold text-emerald-700 dark:text-emerald-400">0 Day Deduction</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Reason / Historical Notes
              </label>
              <textarea
                value={adminReason}
                onChange={(e) => setAdminReason(e.target.value)}
                rows={3}
                placeholder="e.g. Backdated leave record from before application launch (e.g. January 2024)..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                required
              />
            </div>

            {/* Optional Medical Record & Document Attachments Upload for Admin */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                  {adminLeaveType === "Medical Leave" ? "Medical Record / Doctor's Note (Optional)" : "Attachments / Documents (Optional)"}
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Optional
                </span>
              </label>

              <div className="space-y-2">
                <label className={`flex flex-col items-center justify-center p-3.5 border-2 border-dashed rounded-xl cursor-pointer transition ${
                  adminLeaveType === "Medical Leave"
                    ? "border-teal-300 dark:border-teal-700 bg-teal-50/40 dark:bg-teal-950/30 hover:bg-teal-50/80 dark:hover:bg-teal-950/50"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/80"
                }`}>
                  <div className="flex flex-col items-center text-center gap-1">
                    <Upload className={`w-5 h-5 ${adminLeaveType === "Medical Leave" ? "text-teal-600 dark:text-teal-400" : "text-slate-400"}`} />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Click to upload medical record, doctor note, or attachment
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      PDF, PNG, JPG, DOCX (Max 8MB — Optional)
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    multiple
                    onChange={(e) => handleFileChange(e, "admin")}
                    className="hidden"
                  />
                </label>

                {adminAttachments.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {adminAttachments.map((att, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{att.name}</span>
                          {att.size && (
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">
                              ({(att.size / 1024).toFixed(0)} KB)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={att.name}
                            className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                            title="View/Download Attachment"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setAdminAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Remove File"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAdminFormOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adminSubmitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-55 cursor-pointer"
              >
                {adminSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Log Historical Leave
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Who is Not in Office Today & Tomorrow Widget */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white border border-slate-200/60 p-6 rounded-2xl shadow-xs transition-all duration-300 space-y-6"
      >
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <Users className="w-5 h-5 text-indigo-650" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {(() => {
                const dayOfWeek = new Date().getDay();
                const isFridayOrWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;
                return isFridayOrWeekend ? "Who is Not in Office Today & Monday" : "Who is Not in Office Today & Tomorrow";
              })()}
            </h2>
            <p className="text-xs text-slate-500">
              {(() => {
                const dayOfWeek = new Date().getDay();
                const isFridayOrWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;
                return isFridayOrWeekend 
                  ? "Quick check on team members who are out of office today and Monday." 
                  : "Quick check on team members who are out of office today and tomorrow.";
              })()}
            </p>
          </div>
        </div>

        {(() => {
          const today = new Date();
          const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, ..., 5 is Friday, 6 is Saturday
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isFridayOrWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;

          const tomorrowOrMonday = new Date(today);
          if (dayOfWeek === 5) {
            tomorrowOrMonday.setDate(today.getDate() + 3);
          } else if (dayOfWeek === 6) {
            tomorrowOrMonday.setDate(today.getDate() + 2);
          } else if (dayOfWeek === 0) {
            tomorrowOrMonday.setDate(today.getDate() + 1);
          } else {
            tomorrowOrMonday.setDate(today.getDate() + 1);
          }

          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
          const tomorrowOrMondayStr = `${tomorrowOrMonday.getFullYear()}-${String(tomorrowOrMonday.getMonth() + 1).padStart(2, "0")}-${String(tomorrowOrMonday.getDate()).padStart(2, "0")}`;

          const leavesToday = getApprovedLeavesForDate(todayStr);
          const leavesTomorrowOrMonday = getApprovedLeavesForDate(tomorrowOrMondayStr);

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-200/50 dark:divide-white/5">
              {/* Column 1: Today's Status */}
              <div className="space-y-3 pb-4 md:pb-0">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                    Today's Absentees
                  </h3>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200/50 px-2.5 py-1 rounded-full font-mono">
                    {formatDateWithDayOfWeek(todayStr)}
                  </span>
                </div>
                {isWeekend ? (
                  <div className="flex flex-col items-center justify-center py-4 text-center space-y-1 bg-amber-50/50 text-amber-800 border border-amber-200/50 rounded-xl p-4 text-xs font-semibold animate-fade-in shadow-xs">
                    <span className="text-lg animate-bounce">☀️</span>
                    <h4 className="font-bold">Have a great weekend!</h4>
                    <p className="text-[10px] text-amber-750 font-normal">Our office is closed today. Time to relax and recharge!</p>
                  </div>
                ) : leavesToday.length === 0 ? (
                  <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200/50 rounded-xl p-4 text-xs font-semibold animate-fade-in shadow-xs">
                    <span className="text-base shrink-0">🌟</span>
                    <span>Everyone is present and in the office today!</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-3 pt-1 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
                    {leavesToday.map((req, idx) => {
                      const styles = getLeaveTypeStyles(req.leaveType);
                      return (
                        <motion.div 
                          key={req.id} 
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25, delay: idx * 0.04 }}
                          className="bg-slate-50/50 border border-slate-200/50 rounded-xl p-3 flex items-center gap-2.5 shadow-2xs w-full min-w-0"
                        >
                          {renderAvatar(req.requestorEmail, "w-8 h-8 text-xs font-bold")}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-900 truncate" title={req.requestorName}>
                              {req.requestorName}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`inline-block text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border ${styles.bg} ${styles.text} ${styles.border}`}>
                                {req.leaveType}{req.dayType && req.dayType !== "Full Day" ? ` (${req.dayType})` : ""}
                              </span>
                              <span className="text-[9px] text-slate-500 font-semibold truncate" title={`Until ${formatDateForDisplay(req.endDate)}`}>
                                Until {formatDateForDisplay(req.endDate).split(",")[0]}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Column 2: Tomorrow's / Monday's Status */}
              <div className="space-y-3 pt-4 md:pt-0 md:pl-6">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    {isFridayOrWeekend ? "Monday's Absentees" : "Tomorrow's Absentees"}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200/50 px-2.5 py-1 rounded-full font-mono">
                    {formatDateWithDayOfWeek(tomorrowOrMondayStr)}
                  </span>
                </div>
                {leavesTomorrowOrMonday.length === 0 ? (
                  <div className="flex items-center gap-2 bg-indigo-50 text-indigo-800 border border-indigo-200/50 rounded-xl p-4 text-xs font-semibold animate-fade-in shadow-xs">
                    <span className="text-base shrink-0">✨</span>
                    <span>Everyone is scheduled to be present {isFridayOrWeekend ? "on Monday" : "tomorrow"}!</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-3 pt-1 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
                    {leavesTomorrowOrMonday.map((req, idx) => {
                      const styles = getLeaveTypeStyles(req.leaveType);
                      return (
                        <motion.div 
                          key={req.id} 
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25, delay: idx * 0.04 }}
                          className="bg-slate-50/50 border border-slate-200/50 rounded-xl p-3 flex items-center gap-2.5 shadow-2xs w-full min-w-0"
                        >
                          {renderAvatar(req.requestorEmail, "w-8 h-8 text-xs font-bold")}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-900 truncate" title={req.requestorName}>
                              {req.requestorName}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`inline-block text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border ${styles.bg} ${styles.text} ${styles.border}`}>
                                {req.leaveType}{req.dayType && req.dayType !== "Full Day" ? ` (${req.dayType})` : ""}
                              </span>
                              <span className="text-[9px] text-slate-500 font-semibold truncate" title={`Until ${formatDateForDisplay(req.endDate)}`}>
                                Until {formatDateForDisplay(req.endDate).split(",")[0]}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </motion.div>

      {/* Multi-Year History & Annual Allowance Reset Dashboard Widget */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Annual Leave Policy & Multi-Year Selector
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                View leave balances, allowances, and history across multiple calendar years.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
              Leave Year:
            </label>
            <select
              value={selectedLeaveYear}
              onChange={(e) => setSelectedLeaveYear(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="2027">2027 Year</option>
              <option value="2026">2026 (Current Year)</option>
              <option value="2025">2025 Year</option>
              <option value="2024">2024 Year</option>
              <option value="all">All Years Combined</option>
            </select>
          </div>
        </div>

        {/* Status Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-1">
            <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              Annual Leave (10.0 Days)
            </div>
            <div className="text-2xl font-black text-indigo-800 dark:text-indigo-200 font-mono">
              {myAnnualLeavesWeight} <span className="text-xs font-semibold text-indigo-500">/ 10.0 days</span>
            </div>
            <p className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 font-medium">
              {Math.max(0, 10 - myAnnualLeavesWeight)} days remaining balance
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 space-y-1">
            <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Casual Leave (6.0 Days)
            </div>
            <div className="text-2xl font-black text-amber-800 dark:text-amber-200 font-mono">
              {myCasualLeavesWeight} <span className="text-xs font-semibold text-amber-500">/ 6.0 days</span>
            </div>
            <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium">
              {myCasualLeavesWeight >= 6 ? "Strict limit reached (0 left)" : `${Math.max(0, 6 - myCasualLeavesWeight)} days remaining balance`}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 space-y-1">
            <div className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
              Medical Leave (24.0 Days)
            </div>
            <div className="text-2xl font-black text-teal-800 dark:text-teal-200 font-mono">
              {myMedicalLeavesWeight} <span className="text-xs font-semibold text-teal-500">/ 24.0 days</span>
            </div>
            <p className="text-[10px] text-teal-700/80 dark:text-teal-400/80 font-medium">
              2 days / month guideline ({Math.max(0, 24 - myMedicalLeavesWeight)} left)
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Annual Reset Cycle
            </div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 pt-0.5">
              <RefreshCw className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Resets Every Jan 1</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 font-mono">
              {getDaysUntilNextReset()} days until next reset
            </p>
          </div>
        </div>

        {/* Admin Inspection Trigger */}
        {isAdmin && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500 font-medium">
              Admin View: Check leave consumption & remaining balances for all team members in {selectedLeaveYear}.
            </span>
            <button
              onClick={() => setShowAdminResetMatrix(!showAdminResetMatrix)}
              className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              {showAdminResetMatrix ? "Hide Annual Balance Matrix" : "Inspect Team Annual Balances"}
            </button>
          </div>
        )}

        {/* Admin Team Annual Balance Matrix */}
        {isAdmin && showAdminResetMatrix && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Team Annual Balances Breakdown ({selectedLeaveYear === "all" ? "All Years" : selectedLeaveYear})
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">
                Quotas: 10 Annual | 6 Casual | 24 Medical
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold">
                    <th className="py-2 px-2">Team Member</th>
                    <th className="py-2 px-2 text-center">Annual (Max 10)</th>
                    <th className="py-2 px-2 text-center">Casual (Max 6)</th>
                    <th className="py-2 px-2 text-center">Medical (Max 24)</th>
                    <th className="py-2 px-2 text-center">Total Used</th>
                    <th className="py-2 px-2 text-center">Reset Cycle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
                  {teamMembers.map(m => {
                    const memberEmail = m.email.toLowerCase().trim();
                    const memberApproved = requests.filter(req => {
                      if (req.requestorEmail?.toLowerCase().trim() !== memberEmail) return false;
                      if (req.status !== "Approved") return false;
                      if (selectedLeaveYear !== "all") {
                        const startYr = req.startDate ? req.startDate.substring(0, 4) : "";
                        const endYr = req.endDate ? req.endDate.substring(0, 4) : "";
                        return startYr === selectedLeaveYear || endYr === selectedLeaveYear;
                      }
                      return true;
                    });

                    const calcMemberWeight = (matchFn: (t: string) => boolean) => {
                      return memberApproved.reduce((sum, r) => {
                        if (!matchFn(r.leaveType)) return sum;
                        const days = getDaysDifference(r.startDate, r.endDate);
                        const isHalf = r.dayType === "AM" || r.dayType === "PM";
                        return sum + (days * (isHalf ? 0.5 : 1.0));
                      }, 0);
                    };

                    const annUsed = calcMemberWeight(t => t === "Annual Leave");
                    const casUsed = calcMemberWeight(t => t === "Casual Leave" || t === "Urgent Leave");
                    const medUsed = calcMemberWeight(t => t === "Medical Leave");
                    const totUsed = annUsed + casUsed + medUsed;

                    return (
                      <tr key={m.email} className="hover:bg-white/50 dark:hover:bg-slate-700/40 transition">
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            {renderAvatar(m.email, "w-6 h-6 text-[9px] font-extrabold")}
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200">{m.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{m.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold">
                          <span className="text-slate-700 dark:text-slate-300">{annUsed} / 10.0</span>
                          <span className={`block text-[10px] font-semibold ${10 - annUsed <= 2 ? "text-rose-600" : "text-emerald-600"}`}>
                            ({Math.max(0, 10 - annUsed)} left)
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold">
                          <span className="text-slate-700 dark:text-slate-300">{casUsed} / 6.0</span>
                          <span className={`block text-[10px] font-semibold ${casUsed >= 6 ? "text-rose-600 font-extrabold" : "text-amber-600"}`}>
                            ({casUsed >= 6 ? "Limit reached" : `${Math.max(0, 6 - casUsed)} left`})
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold">
                          <span className="text-slate-700 dark:text-slate-300">{medUsed} / 24.0</span>
                          <span className="block text-[10px] text-teal-600 font-semibold">
                            ({Math.max(0, 24 - medUsed)} left)
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {totUsed} days
                        </td>
                        <td className="py-2.5 px-2 text-center text-[10px]">
                          <span className="text-slate-500 font-mono">Resets Jan 1</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      {/* Team Coverage & Overlap Warning Detector Widget */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 rounded-xl text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Team Coverage & Overlap Warning Detector
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monitors concurrent team absences to prevent staffing bottlenecks and schedule overlaps.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCoverageDetector(!showCoverageDetector)}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            {showCoverageDetector ? "Collapse" : "Expand Overview"}
          </button>
        </div>

        {showCoverageDetector && (
          <div className="space-y-4 animate-fade-in">
            {/* Upcoming Overlap Clusters in Next 60 Days */}
            {(() => {
              const clusters = getUpcomingOverlapClusters();
              if (clusters.length === 0) {
                return (
                  <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div>
                      <strong className="font-bold">Optimal Coverage Guaranteed:</strong> No heavy leave overlaps (2+ members) detected in the upcoming 60 days. Team capacity remains above 80%.
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Detected {clusters.length} Concurrent Overlap Window{clusters.length > 1 ? "s" : ""} (Next 60 Days)
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Threshold: 2+ members away
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {clusters.slice(0, 6).map((c, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border text-xs space-y-2 transition shadow-2xs ${
                          c.capacityPct < 60
                            ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200"
                            : "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 font-bold">
                          <span className="font-mono text-xs">{formatDateForDisplay(c.dateStr)}</span>
                          <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-extrabold ${
                            c.capacityPct < 60 ? "bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100" : "bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100"
                          }`}>
                            {c.capacityPct}% Capacity
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 dark:text-slate-300">
                          <strong>{c.count} members away</strong> on this date:
                        </div>

                        <div className="space-y-1">
                          {c.awayRequests.map(req => (
                            <div key={req.id} className="flex items-center justify-between gap-2 p-1 bg-white/70 dark:bg-slate-800/60 rounded text-[10px]">
                              <span className="font-bold truncate">{req.requestorName}</span>
                              <span className="font-mono text-[9px] text-slate-500">{req.leaveType}</span>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => {
                            setSelectedCalDate(c.dateStr);
                            const parts = c.dateStr.split("-");
                            if (parts.length === 3) {
                              setCalYear(parseInt(parts[0], 10));
                              setCalMonth(parseInt(parts[1], 10) - 1);
                            }
                            setTimeout(() => {
                              document.getElementById("team-leave-calendar")?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }, 50);
                          }}
                          className="w-full mt-1 py-1 text-[10px] font-bold text-center bg-white/90 dark:bg-slate-800 hover:bg-white rounded border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                        >
                          Highlight Date on Calendar →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Section 1: Team Scheduled Leaves Calendar Visualization */}
      <div id="team-leave-calendar" className="bg-white rounded-2xl border border-slate-200/60 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 relative">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-indigo-600" />
              Team Leave Calendar
            </h2>
            <p className="text-xs text-slate-500">Monitor scheduled employee time-offs and Burmese gazetted public holidays month-by-month.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            {/* Burmese Public Holidays Badge Button */}
            <button
              type="button"
              onClick={() => setShowHolidaysModal(prev => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-200/80 dark:border-amber-800/60 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
            >
              <span>🇲🇲</span>
              <span className="hidden sm:inline">Myanmar</span>
              <span>Holidays</span>
              <span className="bg-amber-200/80 dark:bg-amber-800/80 text-amber-950 dark:text-amber-100 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                {getBurmeseHolidaysInMonth(calYear, calMonth + 1).length}
              </span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer text-slate-600 dark:text-slate-300"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 min-w-[120px] text-center">
                {monthNames[calMonth]} {calYear}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer text-slate-600 dark:text-slate-300"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Popover list for Burmese Holidays in current month */}
          {showHolidaysModal && (
            <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50 animate-fade-in space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">🇲🇲</span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Burmese Public Holidays ({monthNames[calMonth]} {calYear})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHolidaysModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {(() => {
                const holidaysInCurrentMonth = getBurmeseHolidaysInMonth(calYear, calMonth + 1);
                if (holidaysInCurrentMonth.length === 0) {
                  return (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic py-3 text-center">
                      No gazetted public holidays in {monthNames[calMonth]} {calYear}.
                    </p>
                  );
                }

                return (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                    {holidaysInCurrentMonth.map(({ dateStr, holiday }) => (
                      <div
                        key={dateStr}
                        onClick={() => {
                          setSelectedCalDate(dateStr);
                          setShowHolidaysModal(false);
                        }}
                        className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/50 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-100/50 dark:hover:bg-amber-900/40 transition cursor-pointer flex items-start justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                            <span>🇲🇲</span>
                            <span>{holiday.nameEn}</span>
                          </div>
                          <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                            {holiday.nameMm}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-amber-900 dark:text-amber-200 shrink-0 bg-white/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/60">
                          {formatDateForDisplay(dateStr)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Responsive Calendar Layout */}
        <div className="space-y-1">
          {/* Weekdays row */}
          <div className="grid grid-cols-7 gap-1 text-center py-2.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              const approvedOnDay = getApprovedLeavesForDate(cell.dateStr);
              const burmeseHoliday = getBurmeseHoliday(cell.dateStr);
              const isSelected = selectedCalDate === cell.dateStr;
              const isToday = cell.dateStr === new Date().toISOString().split("T")[0];
              const colIdx = idx % 7;
              const tooltipAlignClass = colIdx === 0 
                ? "left-0 translate-x-0" 
                : colIdx === 6 
                  ? "right-0 left-auto translate-x-0" 
                  : "left-1/2 -translate-x-1/2";

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedCalDate(cell.dateStr)}
                  onMouseEnter={() => setHoveredCalDate(cell.dateStr)}
                  onMouseLeave={() => setHoveredCalDate(null)}
                  className={`min-h-[75px] sm:min-h-[90px] p-1.5 flex flex-col justify-between border rounded-xl transition cursor-pointer text-left relative ${
                    cell.isCurrentMonth
                      ? burmeseHoliday 
                        ? "bg-amber-50/30 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/50 hover:border-amber-400 dark:hover:border-amber-600"
                        : "bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600"
                      : "bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/40 text-slate-400 dark:text-slate-600"
                  } ${
                    isSelected 
                      ? "ring-2 ring-indigo-600 dark:ring-indigo-500 bg-indigo-50/10 border-transparent z-10" 
                      : ""
                  } ${
                    isToday && !isSelected
                      ? "border-indigo-400 dark:border-indigo-500 bg-indigo-50/5"
                      : ""
                  }`}
                >
                  <div className="flex justify-between items-center gap-1">
                    <span className={`text-xs font-bold ${
                      isToday 
                        ? "bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-xs" 
                        : cell.isCurrentMonth ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-600"
                    }`}>
                      {cell.dayNum}
                    </span>
                    
                    <div className="flex items-center gap-1">
                      {burmeseHoliday && (
                        <span className="text-[10px]" title={`🇲🇲 Public Holiday: ${burmeseHoliday.nameEn} (${burmeseHoliday.nameMm})`}>
                          🇲🇲
                        </span>
                      )}
                      {approvedOnDay.length > 0 && (
                        <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full sm:hidden"></span>
                      )}
                    </div>
                  </div>

                  {/* Desktop/Tablet badges list */}
                  <div className="hidden sm:flex flex-col gap-1 mt-1 overflow-y-auto max-h-[50px] pr-0.5 scrollbar-thin">
                    {/* Burmese Holiday Badge */}
                    {burmeseHoliday && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-md truncate max-w-full block bg-amber-100/80 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-800/80 shadow-2xs"
                        title={`🇲🇲 Public Holiday: ${burmeseHoliday.nameEn} (${burmeseHoliday.nameMm})`}
                      >
                        🇲🇲 {burmeseHoliday.nameEn}
                      </span>
                    )}

                    {approvedOnDay.slice(0, burmeseHoliday ? 1 : 2).map((req) => {
                      const styles = getLeaveTypeStyles(req.leaveType);
                      const isHalfDay = req.dayType === "AM" || req.dayType === "PM";
                      const halfDaySuffix = isHalfDay ? ` (${req.dayType})` : "";
                      return (
                        <span
                          key={req.id}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md truncate max-w-full block border ${styles.bg} ${styles.text} ${styles.border}`}
                          title={`${req.requestorName}: ${req.leaveType}${halfDaySuffix}`}
                        >
                          {req.requestorName.split(" ")[0]}{halfDaySuffix}
                        </span>
                      );
                    })}
                    {approvedOnDay.length > (burmeseHoliday ? 1 : 2) && (
                      <span className="text-[8px] font-extrabold text-slate-400 dark:text-slate-500 pl-1">
                        +{approvedOnDay.length - (burmeseHoliday ? 1 : 2)} more
                      </span>
                    )}
                  </div>

                  {/* Rich hover details for team leaves and holidays */}
                  {hoveredCalDate === cell.dateStr && (approvedOnDay.length > 0 || burmeseHoliday) && (
                    <div className={`absolute bottom-[105%] ${tooltipAlignClass} mb-2 w-64 sm:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-3 pointer-events-none text-xs text-slate-800 dark:text-slate-200 animate-fade-in divide-y divide-slate-100 dark:divide-slate-800 space-y-2`}>
                      {burmeseHoliday && (
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-xl text-amber-950 dark:text-amber-200 space-y-0.5">
                          <div className="font-extrabold flex items-center gap-1.5 text-xs text-amber-950 dark:text-amber-200">
                            <span>🇲🇲</span>
                            <span>{burmeseHoliday.nameEn}</span>
                          </div>
                          <div className="text-[11px] font-semibold text-amber-850 dark:text-amber-300">
                            {burmeseHoliday.nameMm}
                          </div>
                          <div className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider pt-0.5">
                            Gazetted Public Holiday
                          </div>
                        </div>
                      )}

                      {approvedOnDay.length > 0 && (
                        <div className="pt-2 space-y-2">
                          <div className="flex justify-between items-center text-slate-900 dark:text-slate-100 font-extrabold">
                            <span className="text-xs tracking-tight">On Leave ({approvedOnDay.length})</span>
                            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                              {formatDateForDisplay(cell.dateStr)}
                            </span>
                          </div>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5 scrollbar-thin">
                            {approvedOnDay.map((req, idx) => {
                              const styles = getLeaveTypeStyles(req.leaveType);
                              const isHalfDay = req.dayType === "AM" || req.dayType === "PM";
                              const halfDaySuffix = isHalfDay ? ` (${req.dayType})` : "";
                              return (
                                <motion.div 
                                  key={req.id} 
                                  initial={{ opacity: 0, x: -12 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                                  className="flex flex-col gap-1 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 truncate">
                                      {renderAvatar(req.requestorEmail, "w-5 h-5 text-[7px] font-extrabold")}
                                      <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                        {req.requestorName}
                                      </span>
                                    </div>
                                    <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 border ${styles.bg} ${styles.text} ${styles.border}`}>
                                      {req.leaveType}{halfDaySuffix}
                                    </span>
                                  </div>
                                  {req.reason && (
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 italic pl-6 truncate" title={req.reason}>
                                      "{req.reason}"
                                    </p>
                                  )}
                                  {req.attachments && req.attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pl-6 pt-0.5">
                                      {req.attachments.map((att, attIdx) => (
                                        <a
                                          key={attIdx}
                                          href={att.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          download={att.name}
                                          className="inline-flex items-center gap-1 text-[9px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-100 transition"
                                          title={`View/Download: ${att.name}`}
                                        >
                                          <Paperclip className="w-2.5 h-2.5 text-teal-600 dark:text-teal-400 shrink-0" />
                                          <span className="truncate max-w-[100px]">{att.name}</span>
                                          <Download className="w-2.5 h-2.5 opacity-70 shrink-0" />
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Admin Panel: Employee Leave Statistics (Admin-only Insights) */}
      {isAdmin && (
        <div className="space-y-4 animate-fade-in bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">Employee Leave Statistics</h2>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 max-w-lg w-full sm:justify-end">
              {/* Employee Selector */}
              <select
                value={statsEmployee}
                onChange={(e) => setStatsEmployee(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[150px] truncate"
              >
                <option value="all">All Employees</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.email}>
                    {m.name}
                  </option>
                ))}
              </select>

              {/* Month Selector */}
              <select
                value={statsMonth}
                onChange={(e) => setStatsMonth(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Months</option>
                <option value="01">January</option>
                <option value="02">February</option>
                <option value="03">March</option>
                <option value="04">April</option>
                <option value="05">May</option>
                <option value="06">June</option>
                <option value="07">July</option>
                <option value="08">August</option>
                <option value="09">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>

              {/* Year Selector */}
              <select
                value={statsYear}
                onChange={(e) => setStatsYear(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Years</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>

              <div className="relative max-w-xs w-full sm:w-auto flex-1">
                <input
                  type="text"
                  placeholder="Search name..."
                  value={statsSearch}
                  onChange={(e) => setStatsSearch(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition text-slate-800"
                />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4 text-center">Number of Days (Scheduled)</th>
                    <th className="py-3 px-4">Leave Types</th>
                    <th className="py-3 px-4">Reasons for Leaving</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs bg-white">
                  {(() => {
                    const filteredMembers = teamMembers.filter(m => {
                      const matchesSearch = m.name.toLowerCase().includes(statsSearch.toLowerCase()) || 
                                           m.email.toLowerCase().includes(statsSearch.toLowerCase());
                      const matchesEmployee = statsEmployee === "all" || m.email.toLowerCase().trim() === statsEmployee.toLowerCase().trim();
                      return matchesSearch && matchesEmployee;
                    });

                    if (filteredMembers.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400 italic">
                            No matching team members found.
                          </td>
                        </tr>
                      );
                    }

                    return filteredMembers.map((member) => {
                      const allMemberRequests = requests.filter(r => r.requestorEmail?.toLowerCase().trim() === member.email?.toLowerCase().trim());
                      
                      // Filter by selected statsMonth and statsYear
                      const memberRequests = allMemberRequests.filter(r => {
                        if (r.status === "Denied") return false;
                        if (statsMonth === "all" && statsYear === "all") return true;
                        
                        const startYear = parseInt(r.startDate.substring(0, 4));
                        const startMonth = parseInt(r.startDate.substring(5, 7));
                        const endYear = parseInt(r.endDate.substring(0, 4));
                        const endMonth = parseInt(r.endDate.substring(5, 7));

                        if (statsYear !== "all") {
                          const yr = parseInt(statsYear);
                          if (startYear > yr || endYear < yr) {
                            return false;
                          }
                        }

                        if (statsMonth !== "all") {
                          const mo = parseInt(statsMonth);
                          if (statsYear !== "all") {
                            const yr = parseInt(statsYear);
                            const periodStart = new Date(yr, mo - 1, 1).getTime();
                            const periodEnd = new Date(yr, mo, 0, 23, 59, 59, 999).getTime();
                            const reqStart = new Date(r.startDate).getTime();
                            const reqEnd = new Date(r.endDate).getTime();
                            return reqStart <= periodEnd && reqEnd >= periodStart;
                          } else {
                            if (startYear === endYear) {
                              return startMonth <= mo && endMonth >= mo;
                            } else {
                              return true;
                            }
                          }
                        }
                        return true;
                      });
                      
                      // Calculate leave types counts
                      const annualCount = memberRequests.filter(r => r.leaveType === "Annual Leave").length;
                      const casualCount = memberRequests.filter(r => r.leaveType === "Casual Leave").length;
                      const urgentCount = memberRequests.filter(r => r.leaveType === "Urgent Leave").length;
                      const medicalCount = memberRequests.filter(r => r.leaveType === "Medical Leave").length;
                      const unpaidCount = memberRequests.filter(r => r.leaveType === "Unpaid Leave").length;

                      const activeLeaveTypes = [
                        { type: "Annual Leave" as LeaveType, count: annualCount },
                        { type: "Casual Leave" as LeaveType, count: casualCount },
                        { type: "Urgent Leave" as LeaveType, count: urgentCount },
                        { type: "Medical Leave" as LeaveType, count: medicalCount },
                        { type: "Unpaid Leave" as LeaveType, count: unpaidCount },
                      ].filter(item => item.count > 0);

                      // Extract non-empty reasons/notes from requests
                      const reasons = memberRequests
                        .map(r => r.reason?.trim())
                        .filter((r): r is string => !!r);

                      const totalRequestsWeight = memberRequests.reduce((sum, r) => {
                        const daysCount = getDaysDifference(r.startDate, r.endDate);
                        if (r.dayType === "AM" || r.dayType === "PM") {
                          return sum + (daysCount * 0.5);
                        }
                        return sum + daysCount;
                      }, 0);

                      return (
                        <tr key={member.id} className="hover:bg-slate-50/40 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {renderAvatar(member.email, "w-7 h-7 text-[9px] font-bold")}
                              <div>
                                <div className="font-bold text-slate-900">{member.name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{member.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-extrabold text-xs text-indigo-700 bg-indigo-50 border border-indigo-150/50 px-2.5 py-1 rounded-lg">
                              {totalRequestsWeight} {totalRequestsWeight === 1 ? "day" : "days"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {activeLeaveTypes.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {activeLeaveTypes.map(item => {
                                  const styles = getLeaveTypeStyles(item.type);
                                  return (
                                    <span
                                      key={item.type}
                                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles.bg} ${styles.text} ${styles.border}`}
                                    >
                                      <span>{item.type}</span>
                                      <span className="opacity-80 font-extrabold">({item.count})</span>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">None</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {reasons.length > 0 ? (
                              <ul className="list-disc pl-4 space-y-1 text-slate-600 max-w-md">
                                {reasons.map((r, idx) => (
                                  <li key={idx} className="text-[11px] leading-relaxed font-semibold">
                                    {r}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">None</span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {/* Section 2: Team Leave History Explorer with Dropdown & Tabs */}
      <div className="bg-white dark:bg-slate-900/90 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              {isAdmin ? "Team Leave History Explorer" : "My Leave History Explorer"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAdmin ? "Select an employee, apply filters, and export leave history to spreadsheet." : "Review and track your historical leave requests."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isAdmin && (
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                title="Export filtered leave history to CSV spreadsheet (compatible with Excel & Google Sheets)"
              >
                <Download className="w-4 h-4" />
                <span>Download CSV ({activeHistoryTab === "team-history" ? filteredHistoryRequests.length : myFilteredRequests.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* CSV Download Success Notification Banner */}
        {csvDownloadSuccess && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-3.5 rounded-xl flex items-center justify-between text-xs font-semibold animate-fade-in shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{csvDownloadSuccess}</span>
            </div>
            <button onClick={() => setCsvDownloadSuccess(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filter controls toolbar for admins */}
        {isAdmin && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-500" />
                Filter Leave History
              </span>
              {(selectedEmployeeEmail !== "all" || selectedHistoryLeaveType !== "all" || selectedHistoryStatus !== "all" || selectedHistoryYear !== "all" || historySearchQuery) && (
                <button
                  onClick={() => {
                    setSelectedEmployeeEmail("all");
                    setSelectedHistoryLeaveType("all");
                    setSelectedHistoryStatus("all");
                    setSelectedHistoryYear("all");
                    setHistorySearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Reset Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {/* Employee selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Employee</label>
                <select
                  value={selectedEmployeeEmail}
                  onChange={(e) => {
                    setSelectedEmployeeEmail(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">All Employees ({teamMembers.length})</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.email}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Leave Type selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Leave Type</label>
                <select
                  value={selectedHistoryLeaveType}
                  onChange={(e) => {
                    setSelectedHistoryLeaveType(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="Annual Leave">Annual Leave</option>
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Medical Leave">Medical Leave</option>
                  <option value="Urgent Leave">Urgent Leave</option>
                  <option value="Unpaid Leave">Unpaid Leave</option>
                </select>
              </div>

              {/* Status selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Status</label>
                <select
                  value={selectedHistoryStatus}
                  onChange={(e) => {
                    setSelectedHistoryStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Denied">Denied</option>
                </select>
              </div>

              {/* Year selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Year</label>
                <select
                  value={selectedHistoryYear}
                  onChange={(e) => {
                    setSelectedHistoryYear(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">All Years</option>
                  <option value="2027">2027</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>

              {/* Search text */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Search Reason / Person</label>
                <input
                  type="text"
                  placeholder="e.g. medical, personal..."
                  value={historySearchQuery}
                  onChange={(e) => {
                    setHistorySearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

         {/* Tab Controls */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 text-sm">
          {isAdmin && (
            <button
              onClick={() => {
                setActiveHistoryTab("team-history");
                setCurrentPage(1);
              }}
              className={`px-4 py-2.5 font-semibold border-b-2 transition-all cursor-pointer ${
                activeHistoryTab === "team-history"
                  ? "border-indigo-650 text-indigo-650 dark:border-indigo-400 dark:text-indigo-400 font-bold"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Team Leave History ({filteredHistoryRequests.length})
            </button>
          )}
          <button
            onClick={() => {
              setActiveHistoryTab("my-history");
              setCurrentPage(1);
            }}
            className={`px-4 py-2.5 font-semibold border-b-2 transition-all cursor-pointer ${
              activeHistoryTab === "my-history"
                ? "border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100 font-bold"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            My Leave History ({myFilteredRequests.length})
          </button>
        </div>

        {/* Tab Views */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            <span className="text-sm text-slate-400 font-semibold">Synchronizing request history...</span>
          </div>
        ) : (
          (() => {
            const displayRequests = activeHistoryTab === "team-history" ? filteredHistoryRequests : myFilteredRequests;
            const totalItems = displayRequests.length;
            const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
            const paginatedRequests = displayRequests.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

            return (
              <div className="overflow-hidden rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse bg-white dark:bg-slate-900">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="py-4 px-6 bg-slate-50 dark:bg-slate-800/80">
                          {activeHistoryTab === "my-history" ? "Leave Type" : "Employee"}
                        </th>
                        {activeHistoryTab !== "my-history" && <th className="py-4 px-6 bg-slate-50 dark:bg-slate-800/80">Leave Type</th>}
                        <th className="py-4 px-6 bg-slate-50 dark:bg-slate-800/80">Duration</th>
                        <th className="py-4 px-6 bg-slate-50 dark:bg-slate-800/80 text-center">Working Days</th>
                        <th className="py-4 px-6 bg-slate-50 dark:bg-slate-800/80">Reason / Notes</th>
                        {isAdmin && <th className="py-4 px-6 bg-slate-50 dark:bg-slate-800/80 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm bg-white dark:bg-slate-900">
                      {paginatedRequests.length === 0 ? (
                        <motion.tr
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <td colSpan={(activeHistoryTab === "my-history" ? 4 : 5) + (isAdmin ? 1 : 0)} className="py-8 text-center text-slate-400 dark:text-slate-500 italic bg-white dark:bg-slate-900">
                            No matching leave requests found in this view.
                          </td>
                        </motion.tr>
                      ) : (
                        paginatedRequests.map((req, idx) => (
                          <motion.tr
                            key={req.id}
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.25, delay: idx * 0.04 }}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition bg-white dark:bg-slate-900"
                          >
                            <td className="py-4 px-6 font-semibold text-slate-850 dark:text-slate-200 bg-white dark:bg-slate-900">
                              {activeHistoryTab === "my-history" ? (
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${getLeaveTypeStyles(req.leaveType).bg} ${getLeaveTypeStyles(req.leaveType).text} ${getLeaveTypeStyles(req.leaveType).border}`}>
                                  {req.leaveType}
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {renderAvatar(req.requestorEmail, "w-6 h-6 text-[8px] font-bold")}
                                  <div>
                                    <div className="font-semibold text-slate-900 dark:text-slate-100">{req.requestorName}</div>
                                    <div className="text-[10px] text-slate-450 dark:text-slate-400 font-mono">{req.requestorEmail}</div>
                                  </div>
                                </div>
                              )}
                            </td>
                            {activeHistoryTab !== "my-history" && (
                              <td className="py-4 px-6 font-semibold bg-white dark:bg-slate-900">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${getLeaveTypeStyles(req.leaveType).bg} ${getLeaveTypeStyles(req.leaveType).text} ${getLeaveTypeStyles(req.leaveType).border}`}>
                                  {req.leaveType}
                                </span>
                              </td>
                            )}
                            <td className="py-4 px-6 text-slate-650 dark:text-slate-300 font-medium bg-white dark:bg-slate-900">
                              <div className="flex flex-col gap-1">
                                <div>{formatDateForDisplay(req.startDate)} to {formatDateForDisplay(req.endDate)}</div>
                                {req.dayType && req.dayType !== "Full Day" && (
                                  <span className="inline-flex items-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 px-2 py-0.5 rounded-md self-start">
                                    {req.dayType === "AM" ? "AM (Half Day)" : "PM (Half Day)"}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center bg-white dark:bg-slate-900">
                              {(() => {
                                const rawDays = getDaysDifference(req.startDate, req.endDate);
                                const weight = rawDays * (req.dayType === "AM" || req.dayType === "PM" ? 0.5 : 1.0);
                                return (
                                  <span className="inline-flex items-center gap-1 font-bold font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 px-2.5 py-1 rounded-lg">
                                    {weight} {weight === 1 ? "day" : "days"}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-4 px-6 text-slate-500 dark:text-slate-400 max-w-xs bg-white dark:bg-slate-900">
                              <div className="truncate" title={req.reason}>{req.reason}</div>
                              {req.attachments && req.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {req.attachments.map((att, attIdx) => (
                                    <a
                                      key={attIdx}
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download={att.name}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800/80 px-2 py-0.5 rounded-md hover:bg-teal-100 dark:hover:bg-teal-900 transition"
                                      title={`View/Download Medical Document: ${att.name}`}
                                    >
                                      <Paperclip className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
                                      <span className="truncate max-w-[120px]">{att.name}</span>
                                      <Download className="w-2.5 h-2.5 opacity-70 shrink-0" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </td>
                            {isAdmin && (
                              <td className="py-4 px-6 text-right bg-white dark:bg-slate-900">
                                <button
                                  onClick={() => handleOpenEditModal(req)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200/80 hover:border-indigo-300 dark:bg-indigo-950/70 dark:hover:bg-indigo-600 dark:text-indigo-300 dark:hover:text-white dark:border-indigo-800/80 dark:hover:border-indigo-500 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                                  title="Edit employee leave form"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  Edit Form
                                </button>
                              </td>
                            )}
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION CONTROLS */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <div className="text-xs text-slate-500 font-semibold">
                      Showing <span className="font-bold text-slate-800">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, totalItems)}</span> to{" "}
                      <span className="font-bold text-slate-800">{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}</span> of{" "}
                      <span className="font-bold text-slate-800">{totalItems}</span> requests
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </button>
                      
                      {/* Page numbers */}
                      <div className="hidden md:flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
                            return (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  currentPage === page
                                    ? "bg-slate-900 text-white shadow-xs"
                                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                {page}
                              </button>
                            );
                          } else if (page === 2 || page === totalPages - 1) {
                            return (
                              <span key={page} className="text-xs text-slate-400 font-bold px-1 select-none">
                                ...
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        )}
      </div>

      {/* ADMIN EDIT LEAVE FORM MODAL */}
      {editingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] my-auto"
          >
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-xl">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Edit Employee Leave Form
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Editing request for: <span className="font-semibold text-slate-700 dark:text-slate-300">{editingRequest.requestorName}</span> ({editingRequest.requestorEmail})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingRequest(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditRequest} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Employee Current Leave Balances Widget */}
              <div className="mb-4">
                {renderLeaveQuotaWidget(editingRequest.requestorEmail, { showTitle: true, titlePrefix: "Employee" })}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Leave Type
                </label>
                <select
                  value={editLeaveType}
                  onChange={(e) => setEditLeaveType(e.target.value as LeaveType)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
                >
                  <option value="Annual Leave">Annual Leave (10 days max/yr)</option>
                  <option value="Casual Leave">Casual Leave (6 days max/yr)</option>
                  <option value="Medical Leave">Medical Leave (24 days max/yr)</option>
                  <option value="Unpaid Leave">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => {
                      setEditStartDate(e.target.value);
                      if (editDayType !== "Full Day" || !editEndDate || editEndDate < e.target.value) {
                        setEditEndDate(e.target.value);
                      }
                    }}
                    required
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editDayType !== "Full Day" ? editStartDate : editEndDate}
                    disabled={editDayType !== "Full Day"}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    required={editDayType === "Full Day"}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Day Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Full Day", "AM", "PM"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setEditDayType(t);
                        if (t !== "Full Day") setEditEndDate(editStartDate);
                      }}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                        editDayType === t
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750"
                      }`}
                    >
                      {t === "Full Day" ? "Full Day" : t === "AM" ? "Morning (AM)" : "Afternoon (PM)"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "Pending" | "Approved" | "Denied")}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
                >
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Denied">Denied</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason / Notes
                </label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={3}
                  placeholder="Reason for leave or admin notes..."
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
                />
              </div>

              {/* Edit Attachments Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                    Medical Records & Attachments
                  </span>
                </label>
                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800 transition">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                      <Upload className="w-4 h-4 text-indigo-500" />
                      <span>Upload additional medical record or document</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      multiple
                      onChange={(e) => handleFileChange(e, "edit")}
                      className="hidden"
                    />
                  </label>

                  {editAttachments.length > 0 && (
                    <div className="space-y-1.5">
                      {editAttachments.map((att, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{att.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={att.name}
                              className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                              title="Download Attachment"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => setEditAttachments(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                              title="Remove File"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-slate-900 pt-3 pb-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0 z-10">
                <button
                  type="button"
                  onClick={() => setEditingRequest(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {editSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* LEAVE POLICY MODAL */}
      <LeavePolicyModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
      />
    </div>
  );
}

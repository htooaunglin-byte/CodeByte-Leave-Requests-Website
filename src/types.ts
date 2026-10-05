export type ProjectStatus = "Not Started" | "Planning" | "In Progress" | "In Review" | "Blocked" | "Completed" | "On Hold";

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  description: string;
  members: string[]; // List of team member emails
  taskOrder?: string[]; // Custom task prioritization order of task IDs
  createdAt?: any;
  updatedAt?: any;
  lastAccessedAt?: any;
}

export interface TaskComment {
  id: string;
  authorEmail: string;
  authorName: string;
  text: string;
  createdAt: string; // ISO string
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string; // format: YYYY-MM-DD
  completedBy?: string | string[]; // email or array of emails of team member(s) who completed it
  comments?: TaskComment[]; // list of comments for discussions
  createdAt?: any;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: "Active" | "Deactivated";
  createdAt?: any;
  updatedAt?: any;
}

export type AssetCategory = "Laptop" | "Monitor" | "Phone" | "Network Equipment" | "Other";
export type AssetOwnership = "Company-owned" | "Rented";
export type AssetStatus = "Available" | "Assigned" | "Under Maintenance" | "Returned to Supplier" | "Retired";
export type AssetCondition = "Good" | "Fair" | "Damaged";
export type RentalBillingPeriod = "Monthly" | "Quarterly" | "Yearly" | "One-time" | "";

export interface CompanyAsset {
  id: string;
  assetCode: string; // Required & unique, e.g. CBC-16
  assetName: string; // Required, e.g. Lenovo ThinkPad X1 Carbon
  category: AssetCategory;
  brandModel?: string;
  serialNumber?: string;
  ownershipType: AssetOwnership;
  accessories: string[]; // e.g. ["Charger", "Laptop bag", "Mouse"]
  status: AssetStatus;
  condition: AssetCondition;
  location?: string;
  notes?: string;

  // Rented asset fields (all optional)
  supplier?: string;
  rentalStartDate?: string; // YYYY-MM-DD
  rentalEndDate?: string; // YYYY-MM-DD
  rentalCost?: number | null;
  rentalCurrency?: string;
  rentalBillingPeriod?: RentalBillingPeriod;

  // Current assignment snapshot (denormalized for fast display; synced atomically)
  activeAssignmentId?: string | null;
  assignedEmployeeId?: string | null;
  assignedEmployeeName?: string | null;
  assignedEmployeeEmail?: string | null;
  assignedDate?: string | null;
  assignedEmployeeDeactivated?: boolean;

  // Supplier return metadata
  returnedToSupplierDate?: string | null;
  returnedToSupplierNotes?: string | null;

  // History & Audit metadata
  hasAssignmentHistory?: boolean;
  createdByEmail?: string;
  createdByName?: string;
  createdAt?: any;
  updatedByEmail?: string;
  updatedByName?: string;
  updatedAt?: any;
}

export interface AssetAssignment {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  category: AssetCategory;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeDeactivated?: boolean;
  status: "Active" | "Returned";

  // Handover fields
  assignedDate: string; // YYYY-MM-DD
  conditionAtHandover: AssetCondition;
  accessoriesHandedOver: string[];
  assignmentNotes?: string;
  assignedByEmail: string;
  assignedByName: string;

  // Return fields
  returnedDate?: string; // YYYY-MM-DD
  conditionAtReturn?: AssetCondition;
  accessoriesReturned?: string[];
  missingOrDamagedItems?: string;
  returnNotes?: string;
  postReturnStatus?: "Available" | "Under Maintenance";
  returnedByEmail?: string;
  returnedByName?: string;

  createdAt?: any;
  updatedAt?: any;
}

export type AssetLogAction =
  | "CREATED"
  | "EDITED"
  | "ASSIGNED"
  | "RETURNED"
  | "RETURNED_TO_SUPPLIER"
  | "RETIRED"
  | "STATUS_CHANGED";

export interface AssetActivityLog {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  action: AssetLogAction;
  summary: string;
  actorEmail: string;
  actorName: string;
  targetEmployeeName?: string;
  targetEmployeeEmail?: string;
  createdAt?: any;
}

export interface RentalAlertInfo {
  level: "none" | "ok" | "due-soon" | "due-today" | "overdue";
  daysRemaining: number | null;
  label: string;
}

export function getRentalAlertInfo(asset: Pick<CompanyAsset, "ownershipType" | "rentalEndDate" | "status">): RentalAlertInfo {
  if (
    asset.ownershipType !== "Rented" ||
    !asset.rentalEndDate ||
    asset.status === "Returned to Supplier" ||
    asset.status === "Retired"
  ) {
    return { level: "none", daysRemaining: null, label: "" };
  }

  const parts = asset.rentalEndDate.split("-").map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return { level: "none", daysRemaining: null, label: "" };
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const endUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  const diffDays = Math.round((endUtc - todayUtc) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      level: "overdue",
      daysRemaining: diffDays,
      label: `Overdue by ${overdueDays} ${overdueDays === 1 ? "day" : "days"}`
    };
  }
  if (diffDays === 0) {
    return {
      level: "due-today",
      daysRemaining: 0,
      label: "Due today"
    };
  }
  if (diffDays <= 30) {
    return {
      level: "due-soon",
      daysRemaining: diffDays,
      label: `Due in ${diffDays} ${diffDays === 1 ? "day" : "days"}`
    };
  }

  return {
    level: "ok",
    daysRemaining: diffDays,
    label: `Due in ${diffDays}d`
  };
}

export type LeaveType = "Annual Leave" | "Casual Leave" | "Urgent Leave" | "Medical Leave" | "Unpaid Leave";
export type LeaveStatus = "Pending" | "Approved" | "Denied";

export interface LeaveAttachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export interface LeaveRequest {
  id: string;
  requestorEmail: string;
  requestorName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  createdAt?: any;
  dayType?: "Full Day" | "AM" | "PM";
  attachments?: LeaveAttachment[];
}

import { getBurmeseHoliday } from "./data/burmeseHolidays";

export interface AdminUser {
  id: string;
  email: string;
  createdAt?: any;
}

export function formatWithDayOfWeek(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length < 3) return dateStr;
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = weekdays[date.getUTCDay()];
  return `${dayName}, ${dateStr}`;
}

export function getDaysDifference(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  const sParts = startStr.split("-").map(Number);
  const eParts = endStr.split("-").map(Number);
  if (sParts.length < 3 || eParts.length < 3) return 0;
  
  const d1 = new Date(Date.UTC(sParts[0], sParts[1] - 1, sParts[2]));
  const d2 = new Date(Date.UTC(eParts[0], eParts[1] - 1, eParts[2]));
  
  if (d1 > d2) return 0;
  
  let count = 0;
  const curDate = new Date(d1.getTime());
  while (curDate <= d2) {
    const day = curDate.getUTCDay();
    const yyyy = curDate.getUTCFullYear();
    const mm = String(curDate.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(curDate.getUTCDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const isHoliday = !!getBurmeseHoliday(dateStr);

    if (day !== 0 && day !== 6 && !isHoliday) { // Exclude weekends (0=Sun, 6=Sat) and gazetted public holidays
      count++;
    }
    curDate.setUTCDate(curDate.getUTCDate() + 1);
  }
  return count;
}

export function getMonthsInRange(startStr: string, endStr: string): string[] {
  if (!startStr) return [];
  const end = endStr || startStr;
  const sParts = startStr.split("-").map(Number);
  const eParts = end.split("-").map(Number);
  if (sParts.length < 3 || eParts.length < 3) return [];

  const cur = new Date(Date.UTC(sParts[0], sParts[1] - 1, 1));
  const last = new Date(Date.UTC(eParts[0], eParts[1] - 1, 1));
  
  const months: string[] = [];
  while (cur <= last) {
    const yyyy = cur.getUTCFullYear();
    const mm = String(cur.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${yyyy}-${mm}`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return months;
}

export function getWorkingDaysInMonth(
  startStr: string,
  endStr: string,
  monthStr: string,
  dayType?: "Full Day" | "AM" | "PM"
): number {
  if (!startStr || !endStr || !monthStr) return 0;
  const sParts = startStr.split("-").map(Number);
  const eParts = endStr.split("-").map(Number);
  if (sParts.length < 3 || eParts.length < 3) return 0;

  const d1 = new Date(Date.UTC(sParts[0], sParts[1] - 1, sParts[2]));
  const d2 = new Date(Date.UTC(eParts[0], eParts[1] - 1, eParts[2]));

  if (d1 > d2) return 0;

  const isHalf = dayType === "AM" || dayType === "PM";
  let count = 0;
  const curDate = new Date(d1.getTime());

  while (curDate <= d2) {
    const yyyy = curDate.getUTCFullYear();
    const mm = String(curDate.getUTCMonth() + 1).padStart(2, "0");
    const dateMonth = `${yyyy}-${mm}`;

    if (dateMonth === monthStr) {
      const day = curDate.getUTCDay();
      const dd = String(curDate.getUTCDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const isHoliday = !!getBurmeseHoliday(dateStr);

      if (day !== 0 && day !== 6 && !isHoliday) {
        count++;
      }
    }
    curDate.setUTCDate(curDate.getUTCDate() + 1);
  }

  return count * (isHalf ? 0.5 : 1.0);
}

/**
 * Company executive & leadership ranking helper
 * 1. Samson (top)
 * 2. Ju Zaw (next in line)
 * 3. Ye Htet Zaw (after that)
 * 4. Carbon (after that)
 * 100. Other team members
 */
export const getTeamMemberRank = (member: { name?: string; email?: string }): number => {
  const name = (member.name || "").toLowerCase().trim();
  const email = (member.email || "").toLowerCase().trim();

  // 1. Samson (at the top)
  if (name.includes("samson") || email.includes("samson")) return 1;

  // 2. Ju Zaw (next in line)
  if (name.includes("ju zaw") || name.includes("ju.zaw") || email.includes("ju.zaw") || email.includes("juzaw") || name.startsWith("ju ")) return 2;

  // 3. Ye Htet Zaw (after that)
  if (name.includes("ye htet") || name.includes("yehtet") || email.includes("yehtet") || email.includes("ye.htet")) return 3;

  // 4. Carbon (after that)
  if (name.includes("carbon") || email.includes("carbon")) return 4;

  return 100;
};



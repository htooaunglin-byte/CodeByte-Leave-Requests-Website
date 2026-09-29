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
  createdAt?: any;
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



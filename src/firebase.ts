import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  where,
  setDoc,
  getDoc,
  serverTimestamp,
  getDocs,
  runTransaction,
  writeBatch,
  enableIndexedDbPersistence
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { 
  Project, 
  Task, 
  TeamMember, 
  LeaveRequest, 
  AdminUser,
  defaultAssetCategories,
  CompanyAsset,
  AssetAssignment,
  AssetActivityLog,
  AssetCondition
} from "./types";

const firebaseConfig = {
  apiKey: "AIzaSyApQKidFpwPxTWVG0Hi31YvA6oDRopHOvc",
  authDomain: "codebyteprojecttracker.firebaseapp.com",
  projectId: "codebyteprojecttracker",
  storageBucket: "codebyteprojecttracker.firebasestorage.app",
  messagingSenderId: "305333414551",
  appId: "1:305333414551:web:6d0d0fb95273be628257d2",
  measurementId: "G-3Q54JXQN6G"
};

// Initialize Firebase safely
let app;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

export const db = app ? getFirestore(app) : null;

if (db) {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      console.warn("Firestore offline persistence failed: multiple tabs open.");
    } else if (err.code === "unimplemented") {
      console.warn("Firestore offline persistence is unimplemented in this browser.");
    } else {
      console.warn("Firestore offline persistence error:", err);
    }
  });
}

export const auth = app ? getAuth(app) : null;
export const googleProvider = app ? new GoogleAuthProvider() : null;

if (googleProvider) {
  googleProvider.addScope("https://www.googleapis.com/auth/spreadsheets");
  googleProvider.addScope("https://www.googleapis.com/auth/gmail.send");
  googleProvider.addScope("https://www.googleapis.com/auth/drive.file");
  googleProvider.setCustomParameters({
    prompt: "select_account"
  });
}

// Collection references
const PROJECTS_COLL = "projects";
const TASKS_COLL = "tasks";
const TEAM_COLL = "team";
const LEAVE_COLL = "leave_requests";

export const projectService = {
  // Listen to all projects in real-time
  subscribeProjects: (onUpdate: (projects: Project[]) => void, onError: (error: any) => void) => {
    if (!db) {
      onError(new Error("Database not initialized"));
      return () => {};
    }
    const q = query(collection(db, PROJECTS_COLL), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      const projects: Project[] = [];
      snapshot.forEach((doc) => {
        projects.push({ id: doc.id, ...doc.data() } as Project);
      });
      onUpdate(projects);
    }, (error) => {
      console.error("Error fetching projects from Firestore:", error);
      onError(error);
    });
  },

  // Add a new project
  addProject: async (project: Omit<Project, "id" | "createdAt" | "updatedAt">) => {
    if (!db) throw new Error("Database not initialized");
    return await addDoc(collection(db, PROJECTS_COLL), {
      ...project,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  // Update an existing project description or details
  updateProject: async (projectId: string, updates: Partial<Omit<Project, "id" | "createdAt" | "updatedAt">>) => {
    if (!db) throw new Error("Database not initialized");
    const projectRef = doc(db, PROJECTS_COLL, projectId);
    return await updateDoc(projectRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  },

  // Delete a project
  deleteProject: async (projectId: string) => {
    if (!db) throw new Error("Database not initialized");
    const projectRef = doc(db, PROJECTS_COLL, projectId);
    return await deleteDoc(projectRef);
  },

  // Task methods (subcollection: projects/{projectId}/tasks)
  subscribeTasks: (projectId: string, onUpdate: (tasks: Task[]) => void, onError: (error: any) => void) => {
    if (!db) {
      onError(new Error("Database not initialized"));
      return () => {};
    }
    const q = query(
      collection(db, PROJECTS_COLL, projectId, TASKS_COLL),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, (snapshot) => {
      const tasks: Task[] = [];
      snapshot.forEach((doc) => {
        tasks.push({ id: doc.id, ...doc.data() } as Task);
      });
      onUpdate(tasks);
    }, (error) => {
      console.error(`Error fetching tasks for project ${projectId}:`, error);
      onError(error);
    });
  },

  addTask: async (projectId: string, title: string, dueDate?: string) => {
    if (!db) throw new Error("Database not initialized");
    return await addDoc(collection(db, PROJECTS_COLL, projectId, TASKS_COLL), {
      title,
      completed: false,
      dueDate: dueDate || null,
      createdAt: serverTimestamp()
    });
  },

  toggleTask: async (projectId: string, taskId: string, completed: boolean) => {
    if (!db) throw new Error("Database not initialized");
    const taskRef = doc(db, PROJECTS_COLL, projectId, TASKS_COLL, taskId);
    const updates: any = { completed };
    if (!completed) {
      updates.completedBy = null;
    }
    return await updateDoc(taskRef, updates);
  },

  updateTask: async (projectId: string, taskId: string, updates: Partial<Omit<Task, "id" | "createdAt">>) => {
    if (!db) throw new Error("Database not initialized");
    const taskRef = doc(db, PROJECTS_COLL, projectId, TASKS_COLL, taskId);
    return await updateDoc(taskRef, updates);
  },

  deleteTask: async (projectId: string, taskId: string) => {
    if (!db) throw new Error("Database not initialized");
    const taskRef = doc(db, PROJECTS_COLL, projectId, TASKS_COLL, taskId);
    return await deleteDoc(taskRef);
  }
};

export const teamService = {
  // Listen to all team members in real-time
  subscribeTeam: (onUpdate: (members: TeamMember[]) => void, onError: (error: any) => void) => {
    if (!db) {
      onError(new Error("Database not initialized"));
      return () => {};
    }
    const q = query(collection(db, TEAM_COLL), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => {
      const members: TeamMember[] = [];
      snapshot.forEach((doc) => {
        members.push({ id: doc.id, ...doc.data() } as TeamMember);
      });
      onUpdate(members);
    }, (error) => {
      console.error("Error fetching team members from Firestore:", error);
      onError(error);
    });
  },

  // Add a new team member
  addTeamMember: async (member: Omit<TeamMember, "id" | "createdAt">) => {
    if (!db) throw new Error("Database not initialized");
    return await addDoc(collection(db, TEAM_COLL), {
      ...member,
      createdAt: serverTimestamp()
    });
  },

  // Update a team member's details
  updateTeamMember: async (memberId: string, updates: Partial<Omit<TeamMember, "id" | "createdAt">>) => {
    if (!db) throw new Error("Database not initialized");
    const memberRef = doc(db, TEAM_COLL, memberId);
    return await updateDoc(memberRef, updates);
  },

  // Remove a team member
  deleteTeamMember: async (memberId: string) => {
    if (!db) throw new Error("Database not initialized");
    const memberRef = doc(db, TEAM_COLL, memberId);
    return await deleteDoc(memberRef);
  },

  // Whitelist check
  checkEmailRegistered: async (email: string): Promise<TeamMember | null> => {
    if (!db) throw new Error("Database not initialized");
    const q = query(collection(db, TEAM_COLL));
    const snapshot = await getDocs(q);
    let found: TeamMember | null = null;
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.email && data.email.toLowerCase().trim() === email.toLowerCase().trim()) {
        found = { id: doc.id, ...data } as TeamMember;
      }
    });
    return found;
  }
};

function sanitizeForFirestore<T>(data: T): any {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) {
    return data
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestore(item));
  }
  if (typeof data === "object" && Object.getPrototypeOf(data) === Object.prototype) {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        cleaned[key] = sanitizeForFirestore(val);
      }
    }
    return cleaned;
  }
  return data;
}

export const leaveService = {
  subscribeLeaveRequests: (onUpdate: (requests: LeaveRequest[]) => void, onError: (error: any) => void) => {
    if (!db) {
      onError(new Error("Database not initialized"));
      return () => {};
    }
    const q = query(collection(db, LEAVE_COLL), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      const requests: LeaveRequest[] = [];
      snapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() } as LeaveRequest);
      });
      onUpdate(requests);
    }, (error) => {
      console.error("Error fetching leave requests from Firestore:", error);
      onError(error);
    });
  },

  addLeaveRequest: async (request: Omit<LeaveRequest, "id" | "createdAt">) => {
    if (!db) throw new Error("Database not initialized");
    const cleanedRequest = sanitizeForFirestore(request);
    return await addDoc(collection(db, LEAVE_COLL), {
      ...cleanedRequest,
      createdAt: serverTimestamp()
    });
  },

  updateLeaveStatus: async (requestId: string, status: "Approved" | "Denied") => {
    if (!db) throw new Error("Database not initialized");
    const leaveRef = doc(db, LEAVE_COLL, requestId);
    return await updateDoc(leaveRef, {
      status
    });
  },

  updateLeaveRequest: async (requestId: string, updates: Partial<LeaveRequest>) => {
    if (!db) throw new Error("Database not initialized");
    const cleanedUpdates = sanitizeForFirestore(updates);
    const leaveRef = doc(db, LEAVE_COLL, requestId);
    return await updateDoc(leaveRef, cleanedUpdates);
  },

  deleteLeaveRequest: async (requestId: string) => {
    if (!db) throw new Error("Database not initialized");
    const leaveRef = doc(db, LEAVE_COLL, requestId);
    return await deleteDoc(leaveRef);
  }
};

const ADMIN_COLL = "admins";

export const adminService = {
  subscribeAdmins: (onUpdate: (admins: AdminUser[]) => void, onError: (error: any) => void) => {
    if (!db) {
      onError(new Error("Database not initialized"));
      return () => {};
    }
    const q = query(collection(db, ADMIN_COLL), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => {
      const admins: AdminUser[] = [];
      snapshot.forEach((doc) => {
        admins.push({ id: doc.id, ...doc.data() } as AdminUser);
      });
      onUpdate(admins);
    }, (error) => {
      console.error("Error fetching admin users from Firestore:", error);
      onError(error);
    });
  },

  addAdmin: async (email: string) => {
    if (!db) throw new Error("Database not initialized");
    const docId = email.toLowerCase().trim().replace(/[^a-z0-9@.-]/g, "_");
    const adminRef = doc(db, ADMIN_COLL, docId);
    return await setDoc(adminRef, {
      email: email.toLowerCase().trim(),
      createdAt: serverTimestamp()
    });
  },

  deleteAdmin: async (id: string) => {
    if (!db) throw new Error("Database not initialized");
    const adminRef = doc(db, ADMIN_COLL, id);
    return await deleteDoc(adminRef);
  },

  checkIsAdmin: async (email: string): Promise<boolean> => {
    const defaultAdmins = ["htooaung.lin@code-byte.io", "ju.zaw@code-byte.io", "samson@code-byte.io", "yehtet.zaw@code-byte.io"];
    const normalized = email.toLowerCase().trim();
    if (defaultAdmins.includes(normalized)) return true;
    if (!db) return false;
    try {
      const q = query(collection(db, ADMIN_COLL));
      const snapshot = await getDocs(q);
      let isAdmin = false;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.email && data.email.toLowerCase().trim() === normalized) {
          isAdmin = true;
        }
      });
      return isAdmin;
    } catch {
      return false;
    }
  }
};

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(error instanceof Error ? error.message : String(error));
}

const ASSETS_COLL = "assets";
const ASSET_ASSIGNMENTS_COLL = "asset_assignments";
const ASSET_LOGS_COLL = "asset_logs";

export function subscribeCategories(next: (names: string[]) => void, error: (err: Error) => void) {
  if (!db) { error(new Error("Database unavailable")); return () => {}; }
  return onSnapshot(doc(db, "asset_settings", "categories"), snap => {
    next(snap.exists() ? snap.data().names : defaultAssetCategories);
  }, error);
}

export async function changeCategory(input: string, remove: boolean) {
  if (!db) throw new Error("Database unavailable");
  const name = input.trim();
  if (!name || name.length > 64) throw new Error("Enter a category name of 1–64 characters.");
  const ref = doc(db, "asset_settings", "categories");
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const names: string[] = snap.exists() ? snap.data().names : defaultAssetCategories;
    const found = names.find(value => value.toLowerCase() === name.toLowerCase());
    if (!remove && found) throw new Error("That category already exists.");
    if (!remove && names.length >= 200) throw new Error("The category list is full (200).");
    tx.set(ref, {names: remove ? names.filter(value => value !== found) : [...names, name]});
  });
}

export const assetService = {
  // Real-time subscription to assets (Admin sees all; employee sees their own assigned assets)
  subscribeAssets: (
    isAdmin: boolean,
    userEmail: string,
    onUpdate: (assets: CompanyAsset[]) => void,
    onError: (error: any) => void
  ) => {
    if (!db) {
      onError(new Error("Database not initialized"));
      return () => {};
    }
    const normalizedEmail = userEmail.toLowerCase().trim();
    const q = isAdmin
      ? query(collection(db, ASSETS_COLL), orderBy("assetCode", "asc"))
      : query(collection(db, ASSETS_COLL), where("assignedEmployeeEmail", "==", normalizedEmail));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: CompanyAsset[] = [];
        snapshot.forEach((d) => {
          if (!d.data().deletedAt) list.push({ id: d.id, ...d.data() } as CompanyAsset);
        });
        list.sort((a, b) => (a.assetCode || "").localeCompare(b.assetCode || "", undefined, { numeric: true }));
        onUpdate(list);
      },
      (error) => {
        console.error("Error fetching assets from Firestore:", error);
        onError(error);
      }
    );
  },

  // Real-time subscription to assignment history
  subscribeAssignments: (
    isAdmin: boolean,
    userEmail: string,
    onUpdate: (assignments: AssetAssignment[]) => void,
    onError: (error: any) => void
  ) => {
    if (!db) {
      onError(new Error("Database not initialized"));
      return () => {};
    }
    const normalizedEmail = userEmail.toLowerCase().trim();
    const q = isAdmin
      ? query(collection(db, ASSET_ASSIGNMENTS_COLL), orderBy("assignedDate", "desc"))
      : query(collection(db, ASSET_ASSIGNMENTS_COLL), where("employeeEmail", "==", normalizedEmail));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: AssetAssignment[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as AssetAssignment);
        });
        list.sort((a, b) => (b.assignedDate || "").localeCompare(a.assignedDate || ""));
        onUpdate(list);
      },
      (error) => {
        console.error("Error fetching asset assignments from Firestore:", error);
        onError(error);
      }
    );
  },

  // Real-time subscription to activity logs (for admins)
  subscribeAssetLogs: (
    isAdmin: boolean,
    onUpdate: (logs: AssetActivityLog[]) => void,
    onError: (error: any) => void
  ) => {
    if (!db || !isAdmin) {
      onUpdate([]);
      return () => {};
    }
    const q = query(collection(db, ASSET_LOGS_COLL));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: AssetActivityLog[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as AssetActivityLog);
        });
        list.sort((a, b) => {
          const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
          const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
          return tB - tA;
        });
        onUpdate(list);
      },
      (error) => {
        console.error("Error fetching asset logs from Firestore:", error);
        onError(error);
      }
    );
  },

  createAsset: async (
    payload: Omit<CompanyAsset, "id" | "createdAt" | "updatedAt">,
    actor: { email: string; name: string }
  ) => (await assetService.createAssets([payload], actor))[0],

  createAssets: async (
    payloads: Omit<CompanyAsset, "id" | "createdAt" | "updatedAt">[],
    actor: { email: string; name: string }
  ): Promise<string[]> => {
    if (!db) throw new Error("Database not initialized");
    const isAuthorized = await adminService.checkIsAdmin(actor.email);
    if (!isAuthorized) {
      throw new Error("Permission denied: Only authorized administrators can create company assets.");
    }
    if (!payloads.length || payloads.length > 200) throw new Error("Import 1–200 assets per file.");
    const inventory = collection(db, ASSETS_COLL);
    const logs = collection(db, ASSET_LOGS_COLL);
    const existing = await getDocs(inventory);
    const codes = new Set(existing.docs.filter(d => !d.data().deletedAt).map(d => String(d.data().assetCode).trim().toUpperCase()));
    const occupied = new Set(existing.docs.map(d => d.id));
    const entries = payloads.map(payload => {
      const normalizedCode = payload.assetCode.trim().toUpperCase();
      if (!normalizedCode || codes.has(normalizedCode)) throw new Error(`Missing or duplicate asset code: ${normalizedCode}`);
      codes.add(normalizedCode);
      // Concurrent creates of the same code must contend on the same document.
      const base = "code-" + encodeURIComponent(normalizedCode);
      let id = base;
      for (let n = 1; occupied.has(id); n++) id = base + ":" + n;
      return {payload, normalizedCode, assetRef: doc(inventory, id), logRef: doc(logs)};
    });
    await runTransaction(db, async transaction => {
      const snapshots = await Promise.all(entries.map(entry => transaction.get(entry.assetRef)));
      if (snapshots.some(snap => snap.exists())) throw new Error("Inventory changed. Review the CSV again.");
      for (const {payload, normalizedCode, assetRef, logRef} of entries) {
        const cleaned = sanitizeForFirestore({
          ...payload,
          assetCode: normalizedCode,
          assetName: payload.assetName.trim(),
          hasAssignmentHistory: false,
          activeAssignmentId: null,
          assignedEmployeeId: null,
          assignedEmployeeName: null,
          assignedEmployeeEmail: null,
          assignedDate: null,
          createdByEmail: actor.email.toLowerCase().trim(),
          createdByName: actor.name,
          updatedByEmail: actor.email.toLowerCase().trim(),
          updatedByName: actor.name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.set(assetRef, cleaned);
        transaction.set(logRef, {
          assetId: assetRef.id,
          assetCode: normalizedCode,
          assetName: payload.assetName.trim(),
          action: "CREATED",
          summary: `Created ${payload.ownershipType.toLowerCase()} ${payload.category.toLowerCase()} asset (${payload.condition} condition).`,
          actorEmail: actor.email.toLowerCase().trim(),
          actorName: actor.name,
          createdAt: serverTimestamp(),
        });

      }
    });
    return entries.map(entry => entry.assetRef.id);
  },

  // Edit an existing asset with uniqueness check on assetCode
  updateAsset: async (
    assetId: string,
    updates: Partial<Omit<CompanyAsset, "id" | "createdAt">>,
    actor: { email: string; name: string },
    logSummary?: string
  ) => {
    if (!db) throw new Error("Database not initialized");
    const isAuthorized = await adminService.checkIsAdmin(actor.email);
    if (!isAuthorized) {
      throw new Error("Permission denied: Only authorized administrators can edit company assets.");
    }

    if (updates.assetCode) {
      const normalizedCode = updates.assetCode.trim().toUpperCase();
      const existingSnap = await getDocs(query(collection(db, ASSETS_COLL)));
      let duplicate = false;
      existingSnap.forEach((d) => {
        if (d.id !== assetId && !d.data().deletedAt) {
          const data = d.data();
          if ((data.assetCode || "").trim().toUpperCase() === normalizedCode) {
            duplicate = true;
          }
        }
      });
      if (duplicate) {
        throw new Error(`Asset code "${normalizedCode}" is already used by another asset.`);
      }
      updates.assetCode = normalizedCode;
    }

    const assetRef = doc(db, ASSETS_COLL, assetId);
    const assetSnap = await getDoc(assetRef);
    if (!assetSnap.exists()) throw new Error("Asset record not found.");
    const currentData = assetSnap.data() as CompanyAsset;

    const batch = writeBatch(db);
    const logRef = doc(collection(db, ASSET_LOGS_COLL));

    const cleanedUpdates = sanitizeForFirestore({
      ...updates,
      updatedByEmail: actor.email.toLowerCase().trim(),
      updatedByName: actor.name,
      updatedAt: serverTimestamp(),
    });

    batch.update(assetRef, cleanedUpdates);
    batch.set(logRef, {
      assetId,
      assetCode: updates.assetCode || currentData.assetCode,
      assetName: updates.assetName || currentData.assetName,
      action: "EDITED",
      summary: logSummary || `Updated asset details (${updates.status || currentData.status}, ${updates.condition || currentData.condition}).`,
      actorEmail: actor.email.toLowerCase().trim(),
      actorName: actor.name,
      createdAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${ASSETS_COLL}/${assetId}`);
    }
  },

  // Atomic Assign Asset using Firestore transaction to prevent concurrent conflicting assignments
  assignAsset: async (
    params: {
      assetId: string;
      employee: TeamMember;
      assignedDate: string;
      conditionAtHandover: AssetCondition;
      accessoriesHandedOver: string[];
      assignmentNotes?: string;
    },
    actor: { email: string; name: string }
  ) => {
    if (!db) throw new Error("Database not initialized");
    const isAuthorized = await adminService.checkIsAdmin(actor.email);
    if (!isAuthorized) {
      throw new Error("Permission denied: Only authorized administrators can assign company assets.");
    }
    const assetRef = doc(db, ASSETS_COLL, params.assetId);
    const assignmentRef = doc(collection(db, ASSET_ASSIGNMENTS_COLL));
    const logRef = doc(collection(db, ASSET_LOGS_COLL));

    try {
      await runTransaction(db, async (transaction) => {
        const assetSnap = await transaction.get(assetRef);
        if (!assetSnap.exists()) {
          throw new Error("Asset no longer exists.");
        }
        const asset = assetSnap.data() as CompanyAsset;

        if (asset.status !== "Available" || asset.activeAssignmentId) {
          throw new Error(
            `Conflict detected: Asset "${asset.assetCode}" is currently "${asset.status}"${
              asset.assignedEmployeeName ? ` (assigned to ${asset.assignedEmployeeName})` : ""
            } and cannot be assigned.`
          );
        }

        const normalizedEmpEmail = (params.employee.email || "").toLowerCase().trim();

        const assignmentRecord = sanitizeForFirestore({
          assetId: params.assetId,
          assetCode: asset.assetCode,
          assetName: asset.assetName,
          category: asset.category,
          employeeId: params.employee.id,
          employeeName: params.employee.name,
          employeeEmail: normalizedEmpEmail,
          employeeDeactivated: params.employee.status === "Deactivated",
          status: "Active",
          assignedDate: params.assignedDate,
          conditionAtHandover: params.conditionAtHandover,
          accessoriesHandedOver: params.accessoriesHandedOver,
          assignmentNotes: params.assignmentNotes || "",
          assignedByEmail: actor.email.toLowerCase().trim(),
          assignedByName: actor.name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.set(assignmentRef, assignmentRecord);
        transaction.update(assetRef, {
          status: "Assigned",
          condition: params.conditionAtHandover,
          activeAssignmentId: assignmentRef.id,
          assignedEmployeeId: params.employee.id,
          assignedEmployeeName: params.employee.name,
          assignedEmployeeEmail: normalizedEmpEmail,
          assignedEmployeeDeactivated: params.employee.status === "Deactivated",
          assignedDate: params.assignedDate,
          hasAssignmentHistory: true,
          updatedByEmail: actor.email.toLowerCase().trim(),
          updatedByName: actor.name,
          updatedAt: serverTimestamp(),
        });

        transaction.set(logRef, {
          assetId: params.assetId,
          assetCode: asset.assetCode,
          assetName: asset.assetName,
          action: "ASSIGNED",
          summary: `Assigned to ${params.employee.name} on ${params.assignedDate} (${params.conditionAtHandover} condition${
            params.accessoriesHandedOver.length > 0 ? `, accessories: ${params.accessoriesHandedOver.join(", ")}` : ""
          }).`,
          actorEmail: actor.email.toLowerCase().trim(),
          actorName: actor.name,
          targetEmployeeName: params.employee.name,
          targetEmployeeEmail: normalizedEmpEmail,
          createdAt: serverTimestamp(),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${ASSETS_COLL}/${params.assetId}`);
    }
  },

  // Atomic Return Asset from employee (preserves assignment history, updates asset status to Available or Under Maintenance)
  returnAsset: async (
    params: {
      assetId: string;
      returnedDate: string;
      conditionAtReturn: AssetCondition;
      accessoriesReturned: string[];
      missingOrDamagedItems?: string;
      returnNotes?: string;
      postReturnStatus: "Available" | "Under Maintenance";
    },
    actor: { email: string; name: string }
  ) => {
    if (!db) throw new Error("Database not initialized");
    const isAuthorized = await adminService.checkIsAdmin(actor.email);
    if (!isAuthorized) {
      throw new Error("Permission denied: Only authorized administrators can process asset returns.");
    }
    const assetRef = doc(db, ASSETS_COLL, params.assetId);
    const logRef = doc(collection(db, ASSET_LOGS_COLL));

    try {
      await runTransaction(db, async (transaction) => {
        const assetSnap = await transaction.get(assetRef);
        if (!assetSnap.exists()) {
          throw new Error("Asset not found.");
        }
        const asset = assetSnap.data() as CompanyAsset;

        if (asset.status !== "Assigned") {
          throw new Error(`Asset "${asset.assetCode}" is not currently assigned (current status: ${asset.status}).`);
        }

        const prevEmployeeName = asset.assignedEmployeeName || "Employee";
        const prevEmployeeEmail = asset.assignedEmployeeEmail || "";

        if (asset.activeAssignmentId) {
          const assignmentRef = doc(db, ASSET_ASSIGNMENTS_COLL, asset.activeAssignmentId);
          const assignmentSnap = await transaction.get(assignmentRef);
          if (assignmentSnap.exists()) {
            transaction.update(assignmentRef, sanitizeForFirestore({
              status: "Returned",
              returnedDate: params.returnedDate,
              conditionAtReturn: params.conditionAtReturn,
              accessoriesReturned: params.accessoriesReturned,
              missingOrDamagedItems: params.missingOrDamagedItems || "",
              returnNotes: params.returnNotes || "",
              postReturnStatus: params.postReturnStatus,
              returnedByEmail: actor.email.toLowerCase().trim(),
              returnedByName: actor.name,
              updatedAt: serverTimestamp(),
            }));
          }
        }

        transaction.update(assetRef, {
          status: params.postReturnStatus,
          condition: params.conditionAtReturn,
          activeAssignmentId: null,
          assignedEmployeeId: null,
          assignedEmployeeName: null,
          assignedEmployeeEmail: null,
          assignedEmployeeDeactivated: false,
          assignedDate: null,
          hasAssignmentHistory: true,
          updatedByEmail: actor.email.toLowerCase().trim(),
          updatedByName: actor.name,
          updatedAt: serverTimestamp(),
        });

        const issueNote = params.missingOrDamagedItems?.trim()
          ? ` — Missing/Damaged: ${params.missingOrDamagedItems.trim()}`
          : "";

        transaction.set(logRef, {
          assetId: params.assetId,
          assetCode: asset.assetCode,
          assetName: asset.assetName,
          action: "RETURNED",
          summary: `Returned from ${prevEmployeeName} on ${params.returnedDate}. Condition: ${params.conditionAtReturn}. Next status: ${params.postReturnStatus}${issueNote}.`,
          actorEmail: actor.email.toLowerCase().trim(),
          actorName: actor.name,
          targetEmployeeName: prevEmployeeName,
          targetEmployeeEmail: prevEmployeeEmail,
          createdAt: serverTimestamp(),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${ASSETS_COLL}/${params.assetId}`);
    }
  },

  // Separate Return to Supplier action for Rented assets (only when no active employee assignment)
  returnToSupplier: async (
    params: {
      assetId: string;
      returnedToSupplierDate: string;
      returnedToSupplierNotes?: string;
    },
    actor: { email: string; name: string }
  ) => {
    if (!db) throw new Error("Database not initialized");
    const isAuthorized = await adminService.checkIsAdmin(actor.email);
    if (!isAuthorized) {
      throw new Error("Permission denied: Only authorized administrators can return rented assets to suppliers.");
    }
    const assetRef = doc(db, ASSETS_COLL, params.assetId);
    const logRef = doc(collection(db, ASSET_LOGS_COLL));

    try {
      await runTransaction(db, async (transaction) => {
        const assetSnap = await transaction.get(assetRef);
        if (!assetSnap.exists()) throw new Error("Asset not found.");
        const asset = assetSnap.data() as CompanyAsset;

        if (asset.ownershipType !== "Rented") {
          throw new Error("Only rented assets can be returned to a rental supplier.");
        }
        if (asset.status === "Assigned" || asset.activeAssignmentId) {
          throw new Error("Cannot return to supplier while the asset has an active employee assignment. Return the asset from the employee first.");
        }

        transaction.update(assetRef, {
          status: "Returned to Supplier",
          returnedToSupplierDate: params.returnedToSupplierDate,
          returnedToSupplierNotes: params.returnedToSupplierNotes || "",
          updatedByEmail: actor.email.toLowerCase().trim(),
          updatedByName: actor.name,
          updatedAt: serverTimestamp(),
        });

        transaction.set(logRef, {
          assetId: params.assetId,
          assetCode: asset.assetCode,
          assetName: asset.assetName,
          action: "RETURNED_TO_SUPPLIER",
          summary: `Returned rented asset to supplier${asset.supplier ? ` (${asset.supplier})` : ""} on ${params.returnedToSupplierDate}.${
            params.returnedToSupplierNotes ? ` Notes: ${params.returnedToSupplierNotes}` : ""
          }`,
          actorEmail: actor.email.toLowerCase().trim(),
          actorName: actor.name,
          createdAt: serverTimestamp(),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${ASSETS_COLL}/${params.assetId}`);
    }
  },

  // Retire an asset (preferred over deletion)
  retireAsset: async (
    assetId: string,
    reason: string,
    actor: { email: string; name: string }
  ) => {
    if (!db) throw new Error("Database not initialized");
    const isAuthorized = await adminService.checkIsAdmin(actor.email);
    if (!isAuthorized) {
      throw new Error("Permission denied: Only authorized administrators can retire company assets.");
    }
    const assetRef = doc(db, ASSETS_COLL, assetId);
    const logRef = doc(collection(db, ASSET_LOGS_COLL));

    try {
      await runTransaction(db, async (transaction) => {
        const assetSnap = await transaction.get(assetRef);
        if (!assetSnap.exists()) throw new Error("Asset not found.");
        const asset = assetSnap.data() as CompanyAsset;

        if (asset.status === "Assigned" || asset.activeAssignmentId) {
          throw new Error("Cannot retire an asset while it is actively assigned to an employee. Return the asset first.");
        }

        transaction.update(assetRef, {
          status: "Retired",
          notes: reason ? `${asset.notes ? asset.notes + "\n" : ""}[Retired]: ${reason}` : asset.notes || "",
          updatedByEmail: actor.email.toLowerCase().trim(),
          updatedByName: actor.name,
          updatedAt: serverTimestamp(),
        });

        transaction.set(logRef, {
          assetId,
          assetCode: asset.assetCode,
          assetName: asset.assetName,
          action: "RETIRED",
          summary: `Asset retired${reason ? `: ${reason}` : "."}`,
          actorEmail: actor.email.toLowerCase().trim(),
          actorName: actor.name,
          createdAt: serverTimestamp(),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${ASSETS_COLL}/${assetId}`);
    }
  },

  // Permanent deletion ONLY allowed for mistakenly created assets with NO assignment history
  deleteAsset: async (reviewed: CompanyAsset, actor: {email: string; name: string}) => {
    if (!db) throw new Error("Database unavailable");
    const assetId = reviewed.id;
    const assetRef = doc(db, ASSETS_COLL, assetId);
    const log = doc(collection(db, ASSET_LOGS_COLL));
    const records = collection(db, ASSET_ASSIGNMENTS_COLL);
    // Older assignments may lack the active-assignment pointer on the asset.
    const history = await getDocs(query(records, where("assetId", "==", assetId)));
    const activeIds = history.docs.filter(d => d.data().status === "Active").map(d => d.id);
    await runTransaction(db, async tx => {
      const snap = await tx.get(assetRef);
      if (!snap.exists() || snap.data().deletedAt) throw new Error("This asset has already been removed.");
      const asset = snap.data() as CompanyAsset;
      if (asset.status !== reviewed.status || asset.activeAssignmentId !== reviewed.activeAssignmentId ||
          asset.assignedEmployeeId !== reviewed.assignedEmployeeId || asset.assetCode !== reviewed.assetCode) {
        throw new Error("This asset changed. Close this dialog and review it again before deleting.");
      }
      const ids = new Set(activeIds);
      if (asset.activeAssignmentId) ids.add(asset.activeAssignmentId);
      const assignments = await Promise.all([...ids].map(id => tx.get(doc(records, id))));
      for (const record of assignments) {
        if (record.exists() && record.data().assetId === assetId && record.data().status === "Active") {
          tx.update(record.ref, {status: "Asset removed", updatedAt: serverTimestamp()});
        }
      }
      tx.update(assetRef, {deletedAt: serverTimestamp(), deletedByEmail: actor.email, status: "Retired",
        activeAssignmentId: null, assignedEmployeeEmail: null, assignedEmployeeName: null,
        assignedEmployeeId: null, assignedDate: null, updatedAt: serverTimestamp()});
      tx.set(log, {assetId, assetCode: asset.assetCode, assetName: asset.assetName, action: "REMOVED",
        summary: "Removed from inventory", actorName: actor.name, actorEmail: actor.email, createdAt: serverTimestamp()});
    });
  },

  // Flag active assignments & assets when an employee is deactivated or removed while holding equipment
  flagEmployeeAssetsDeactivated: async (employeeId: string, employeeEmail: string, isDeactivated: boolean) => {
    if (!db) return;
    const batch = writeBatch(db);
    const normalizedEmail = (employeeEmail || "").toLowerCase().trim();

    const assetsSnap = await getDocs(query(collection(db, ASSETS_COLL), where("status", "==", "Assigned")));
    assetsSnap.forEach((d) => {
      const data = d.data() as CompanyAsset;
      if (
        data.assignedEmployeeId === employeeId ||
        (normalizedEmail && (data.assignedEmployeeEmail || "").toLowerCase().trim() === normalizedEmail)
      ) {
        batch.update(doc(db, ASSETS_COLL, d.id), {
          assignedEmployeeDeactivated: isDeactivated,
          updatedAt: serverTimestamp(),
        });
      }
    });

    const assignSnap = await getDocs(query(collection(db, ASSET_ASSIGNMENTS_COLL), where("status", "==", "Active")));
    assignSnap.forEach((d) => {
      const data = d.data() as AssetAssignment;
      if (
        data.employeeId === employeeId ||
        (normalizedEmail && (data.employeeEmail || "").toLowerCase().trim() === normalizedEmail)
      ) {
        batch.update(doc(db, ASSET_ASSIGNMENTS_COLL, d.id), {
          employeeDeactivated: isDeactivated,
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
  }
};




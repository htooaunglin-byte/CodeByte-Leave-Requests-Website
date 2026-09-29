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
  setDoc,
  serverTimestamp,
  getDocs,
  enableIndexedDbPersistence
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { Project, Task, TeamMember, LeaveRequest, AdminUser } from "./types";

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
  if (typeof data === "object" && !(data instanceof Date)) {
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



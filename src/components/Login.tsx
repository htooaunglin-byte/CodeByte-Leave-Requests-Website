import { useState } from "react";
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider, teamService, adminService } from "../firebase";
import { Shield, AlertTriangle, Database } from "lucide-react";
import Logo from "./Logo";

interface LoginProps {
  onLoginSuccess: (email: string, name: string, isDemo?: boolean) => void;
  isLive: boolean;
  dbError: string | null;
}

export default function Login({ onLoginSuccess, isLive, dbError }: LoginProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleGoogleLogin = async () => {
    if (!auth || !googleProvider) {
      setError("Firebase Authentication is not initialized properly.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Sign in using popup
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      if (!user || !user.email) {
        throw new Error("No email associated with this Google Account.");
      }

      const email = user.email.toLowerCase().trim();
      const displayName = user.displayName || email.split("@")[0];

      // Query database to check if email is in the whitelisted team or admin list
      const teamRecord = await teamService.checkEmailRegistered(email);
      const isAdminUser = await adminService.checkIsAdmin(email);

      if (teamRecord || isAdminUser) {
        // Whitelisted!
        onLoginSuccess(email, teamRecord ? teamRecord.name : displayName, false);
      } else {
        // Not whitelisted! Sign out and display clear error
        await signOut(auth);
        setError("Access denied. Your email is not registered as an active team member or administrator.");
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      // Handle the case where popup is blocked or closed
      if (err.code === "auth/popup-closed-by-user") {
        setError("Login popup was closed. Please try again.");
      } else if (err.code === "auth/unauthorized-domain" || (err.message && err.message.includes("unauthorized-domain"))) {
        setError("unauthorized-domain");
      } else {
        setError(err.message || "An unexpected error occurred during sign-in.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center py-12 sm:px-6 lg:px-8 antialiased font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-6">
          <Logo className="h-10" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Leave Management Portal
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Secure, whitelist-only employee leave request portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-200/60 sm:px-10 space-y-6">
          
          {/* Whitelist Banner */}
          <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl flex gap-3">
            <Shield className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-800">Dynamic Security:</span> Only registered emails in the active Team Members list or Admin whitelist can log in. Unauthorized access is auto-blocked.
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex gap-3 text-rose-900 text-xs animate-shake">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                {error === "unauthorized-domain" ? (
                  <>
                    <p className="font-bold">Firebase Domain Not Whitelisted</p>
                    <p className="text-rose-750 leading-relaxed">
                      This preview domain is not authorized in your Firebase project. To enable live Google Sign-In, please add the following domain in your Firebase Console under <strong className="text-rose-900">Authentication &gt; Settings &gt; Authorized domains</strong>:
                    </p>
                    <div className="p-2 bg-rose-100/60 rounded font-mono text-[10px] select-all break-all text-rose-950 font-bold border border-rose-200 my-1.5">
                      {window.location.hostname}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-bold">Access Verification Failed</p>
                    <p className="text-rose-700">{error}</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Core Login Area */}
          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loading || !isLive}
              className={`w-full flex justify-center items-center gap-3 py-2.5 px-4 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 shadow-sm transition ${
                (!isLive || loading) ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {loading ? "Verifying Access..." : "Sign in with Google"}
            </button>
          </div>

          {/* Database Info */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <div className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {isLive ? "Live Connected to Firestore" : dbError || "Offline Fallback Cache Enabled"}
              </span>
            </div>
            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">v1.2.0</span>
          </div>

        </div>
      </div>
    </div>
  );
}

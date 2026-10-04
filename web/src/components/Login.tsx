import React, { useState } from "react";
import { Lock, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { api } from "../api";

export function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");

    try {
      await api.login(password);
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="glass-panel w-full max-w-[420px] p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center mx-auto mb-6 shadow-[0_0_25px_rgba(99,102,241,0.4)]">
          <ShieldCheck size={32} className="text-white" />
        </div>

        <h1 className="text-2xl font-bold mb-2 text-white">
          46-Bot Control Center
        </h1>
        <p className="text-slate-400 text-sm mb-8">
          Manage channels, messages, reminders & calendar
        </p>

        {error && (
          <div className="flex items-center gap-2 p-3 px-4 bg-rose-500/15 border border-rose-500/30 rounded-lg text-rose-400 text-sm mb-6 text-left">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="relative mb-6">
            <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              placeholder="Enter ADMIN_PASSWORD..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input pl-11"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full py-3"
            disabled={loading}
          >
            {loading ? "Authenticating..." : (
              <>
                <span>Enter Dashboard</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

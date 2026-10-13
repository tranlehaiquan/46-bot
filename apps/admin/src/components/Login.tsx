import React, { useState } from "react";
import { Lock, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { Button, TextField, Callout } from "@radix-ui/themes";
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
          <Callout.Root color="red" size="1" className="mb-6 text-left">
            <Callout.Icon>
              <AlertCircle size={16} />
            </Callout.Icon>
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField.Root
            type="password"
            placeholder="Enter ADMIN_PASSWORD..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            size="3"
            autoFocus
            required
          >
            <TextField.Slot>
              <Lock size={16} className="text-slate-400" />
            </TextField.Slot>
          </TextField.Root>

          <Button
            type="submit"
            size="3"
            loading={loading}
            className="w-full cursor-pointer"
          >
            <span>Enter Dashboard</span>
            {!loading && <ArrowRight size={16} />}
          </Button>
        </form>
      </div>
    </div>
  );
}

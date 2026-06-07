"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, Shield } from "lucide-react";

export function AmfnLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/amfn/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Login failed. Please try again.");
        return;
      }

      router.push("/amfn/portal");
      router.refresh();
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="username" className="text-sm text-gray-400">
          Username
        </Label>
        <div className="relative">
          <Input
            id="username"
            value="AMFN"
            readOnly
            className="bg-white/[0.03] border-white/[0.06] text-[#03FF00] font-mono cursor-not-allowed pl-10"
          />
          <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#03FF00]/50" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm text-gray-400">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter portal password"
            className="bg-white/[0.03] border-white/[0.06] text-white placeholder:text-gray-600 pr-10 focus:border-[#03FF00]/30 focus:ring-[#03FF00]/20"
            disabled={loading}
            autoFocus
            required
          />
          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/5 border-l-2 border-red-400 rounded-r-lg px-3 py-2">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading || !password}
        className="w-full bg-[#03FF00] hover:bg-[#03FF00]/90 text-[#0a0e1a] font-semibold disabled:opacity-50 amfn-btn-shine"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Authenticating...
          </>
        ) : (
          <>
            <Shield className="mr-2 h-4 w-4" />
            Access Portal
          </>
        )}
      </Button>
    </form>
  );
}

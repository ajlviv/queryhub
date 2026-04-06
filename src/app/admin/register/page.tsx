"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Tier = "default" | "basic" | "pro";

function parseTier(raw: string | null): Tier {
  if (raw === "basic" || raw === "pro") return raw;
  return "default";
}

export default function AdminRegisterPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tier, setTier] = useState<Tier>(() => {
    if (typeof window === "undefined") return "default";
    return parseTier(new URLSearchParams(window.location.search).get("tier"));
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyName, email, password, tier }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }
      router.push("/admin/questionnaires");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-900">Create company admin</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-zinc-600">Company name</span>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-zinc-600">Your email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-zinc-600">Password (min 8)</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-zinc-600">Tier</span>
          <select
            value={tier}
            onChange={(e) => setTier(parseTier(e.target.value))}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="default">Default</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
          </select>
        </label>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Creating…" : "Register"}
        </button>
      </form>
      <p className="text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/admin/login" className="font-medium text-zinc-900 underline">
          Login
        </Link>
      </p>
    </div>
  );
}

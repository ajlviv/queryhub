"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Tier = "default" | "basic" | "pro";
type Company = { id: string; name: string; tier: Tier };

function parseTier(raw: string | null): Tier | null {
  if (raw === "default" || raw === "basic" || raw === "pro") return raw;
  return null;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [tier, setTier] = useState<Tier>("default");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      if (meRes.status === 401) {
        router.replace("/admin/login");
        return;
      }

      const res = await fetch("/api/admin/company", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!cancelled) setError(data.error ?? "Failed to load company settings");
        return;
      }

      const queryTier = parseTier(new URLSearchParams(window.location.search).get("tier"));
      if (!cancelled) {
        setCompany(data.company);
        setTier(queryTier ?? data.company.tier);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const hasChanges = useMemo(() => company !== null && company.tier !== tier, [company, tier]);

  async function saveTier() {
    if (!company || !hasChanges) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tier }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setCompany(data.company);
      setSuccess("Tier updated successfully.");
    } finally {
      setSaving(false);
    }
  }

  if (!company && !error) return <p className="text-zinc-600">Loading settings…</p>;
  if (error && !company) return <p className="text-red-600">{error}</p>;

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-900">Company settings</h1>
      <p className="text-sm text-zinc-600">
        {company!.name} - choose a tier to control your questionnaire limits.
      </p>

      <label className="block space-y-1">
        <span className="text-sm text-zinc-600">Tier</span>
        <select
          value={tier}
          onChange={(e) => {
            setTier(parseTier(e.target.value) ?? "default");
            setSuccess(null);
          }}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
        >
          <option value="default">Default</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
        </select>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}
      <button
        type="button"
        disabled={saving || !hasChanges}
        onClick={() => saveTier()}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save tier"}
      </button>
    </div>
  );
}

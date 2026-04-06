"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Row = {
  id: string;
  email: string;
  status: string;
  score: number | null;
  startedAt: string;
  submittedAt: string | null;
};

export default function SubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/admin/questionnaires/${id}/submissions`, {
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) {
        setError(j.error ?? "Failed to load");
        return;
      }
      setItems(j.items ?? []);
      setError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }
  if (items === null) {
    return <p className="text-zinc-600">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/questionnaires/${id}`}
        className="text-sm text-zinc-500 hover:text-zinc-800"
      >
        ← Back to questionnaire
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-900">Submissions</h1>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Score %</th>
              <th className="px-4 py-2 font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  No submissions yet.
                </td>
              </tr>
            )}
            {items.map((s) => (
              <tr key={s.id} className="border-b border-zinc-100">
                <td className="px-4 py-2">{s.email}</td>
                <td className="px-4 py-2">{s.status}</td>
                <td className="px-4 py-2">
                  {s.score != null ? s.score.toFixed(1) : "—"}
                </td>
                <td className="px-4 py-2 text-zinc-600">
                  {s.submittedAt
                    ? new Date(s.submittedAt).toLocaleString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  title: string;
  publicToken: string;
  status: string;
  lockedAt: string | null;
  questionCount: number;
  submissionCount: number;
};

export default function QuestionnairesListPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const qRes = await fetch("/api/admin/questionnaires", {
        credentials: "include",
      });
      const data = await qRes.json().catch(() => ({}));
      if (!qRes.ok) {
        if (!cancelled) setError(data.error ?? "Failed to load");
        return;
      }
      if (!cancelled) setItems(data.items ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/admin/login");
  }

  if (items === null && !error) {
    return <p className="text-zinc-600">Loading…</p>;
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900">Questionnaires</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            Log out
          </button>
          <Link
            href="/admin/questionnaires/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            New questionnaire
          </Link>
        </div>
      </div>

      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {items!.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-zinc-500">
            No questionnaires yet.
          </li>
        )}
        {items!.map((q) => (
          <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <Link
                href={`/admin/questionnaires/${q.id}`}
                className="font-medium text-zinc-900 hover:underline"
              >
                {q.title}
              </Link>
              <p className="text-xs text-zinc-500">
                {q.status} · {q.questionCount} questions · {q.submissionCount}{" "}
                submissions
                {q.lockedAt ? " · locked" : ""}
              </p>
            </div>
            <Link
              href={`/q/${q.publicToken}`}
              className="text-sm text-zinc-600 hover:text-zinc-900"
              target="_blank"
              rel="noreferrer"
            >
              Open participant link
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

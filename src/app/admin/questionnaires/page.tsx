"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { maxQuestionnairesForTier } from "@/lib/tiers";
import type { CompanyTier } from "@prisma/client";

type Item = {
  id: string;
  title: string;
  publicToken: string;
  status: string;
  lockedAt: string | null;
  questionCount: number;
  submissionCount: number;
  tier: string;
};

type PageResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: Item[];
};

const PAGE_SIZE = 10;

export default function QuestionnairesListPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }

      const qRes = await fetch(`/api/admin/questionnaires?page=${page}&pageSize=${PAGE_SIZE}`, {
        credentials: "include",
      });
      const data = await qRes.json().catch(() => ({}));

      if (!qRes.ok) {
        if (!cancelled) {
          setError(data.error ?? "Failed to load questionnaires");
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        const payload = data as PageResponse;
        setItems(payload.items ?? []);
        setTotal(payload.total ?? 0);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/admin/login");
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(total, page * PAGE_SIZE);

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  if (items === null || loading) {
    return <p className="text-zinc-600">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Questionnaires</h1>
          <p className="text-sm text-zinc-500">
            Showing {startIndex}-{endIndex} of {total}
          </p>
        </div>

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
        {items.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-zinc-500">
            No questionnaires yet.
          </li>
        )}
        {items.map((q) => (
          <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <Link
                href={`/admin/questionnaires/${q.id}`}
                className="font-medium text-zinc-900 hover:underline"
              >
                {q.title}
              </Link>
              <p className="text-xs text-zinc-500">
                {q.status} · {q.questionCount} questions · {q.submissionCount} submissions
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

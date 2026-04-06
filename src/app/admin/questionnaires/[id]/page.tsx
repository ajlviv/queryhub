"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type QDetail = {
  id: string;
  title: string;
  publicToken: string;
  status: string;
  lockedAt: string | null;
  questionsPerPage: number | null;
  timeLimitSeconds: number | null;
  allowMultipleCorrect: boolean;
  isAllowedEmailsEnabled: boolean;
  accessType: string;
  resultsMode: string;
  allowedEmails: string[];
  questions: {
    id: string;
    title: string;
    enabled: boolean;
    allowMultiple: boolean;
    options: { id: string; label: string; isCorrect: boolean }[];
  }[];
};

export default function QuestionnaireEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<QDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [allowedText, setAllowedText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/admin/questionnaires/${id}`, {
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
      setData(j);
      setAllowedText((j.allowedEmails as string[]).join(", "));
      setError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  async function saveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    setBusy(true);
    setMsg(null);
    const form = new FormData(e.currentTarget);
    const emails = (form.get("allowedEmails") as string)
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const qpp = String(form.get("questionsPerPage") ?? "").trim();
    const tls = String(form.get("timeLimitSeconds") ?? "").trim();

    const body = {
      title: form.get("title") as string,
      questionsPerPage: qpp === "" ? null : Number(qpp),
      timeLimitSeconds: tls === "" ? null : Number(tls),
      allowMultipleCorrect: form.get("allowMultipleCorrect") === "on",
      isAllowedEmailsEnabled: form.get("isAllowedEmailsEnabled") === "on",
      accessType: form.get("accessType") as string,
      resultsMode: form.get("resultsMode") as string,
      allowedEmails: emails,
    };

    const res = await fetch(`/api/admin/questionnaires/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(j.error ?? "Save failed");
      return;
    }
    setMsg("Saved.");
    const r = await fetch(`/api/admin/questionnaires/${id}`, {
      credentials: "include",
    });
    const jj = await r.json().catch(() => ({}));
    if (r.ok) {
      setData(jj);
      setAllowedText((jj.allowedEmails as string[]).join(", "));
    }
  }

  async function importRaw() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/questionnaires/${id}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ raw: rawText }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(j.error ?? "Import failed");
      return;
    }
    setMsg("Imported.");
    setRawText("");
    const r = await fetch(`/api/admin/questionnaires/${id}`, {
      credentials: "include",
    });
    const jj = await r.json().catch(() => ({}));
    if (r.ok) setData(jj);
  }

  async function publish() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/questionnaires/${id}/publish`, {
      method: "POST",
      credentials: "include",
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(j.error ?? "Publish failed");
      return;
    }
    setMsg("Published.");
    const r = await fetch(`/api/admin/questionnaires/${id}`, {
      credentials: "include",
    });
    const jj = await r.json().catch(() => ({}));
    if (r.ok) setData(jj);
  }

  async function archive() {
    if (!confirm("Archive this questionnaire?")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/questionnaires/${id}/archive`, {
      method: "POST",
      credentials: "include",
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? "Archive failed");
      return;
    }
    router.push("/admin/questionnaires");
  }

  if (error && !data) {
    return <p className="text-red-600">{error}</p>;
  }
  if (!data) {
    return <p className="text-zinc-600">Loading…</p>;
  }

  const locked = !!data.lockedAt;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/questionnaires"
            className="text-sm text-zinc-500 hover:text-zinc-800"
          >
            ← All questionnaires
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{data.title}</h1>
          <p className="text-sm text-zinc-500">
            Status: {data.status}
            {locked ? " · structure locked" : ""}
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-600">
            Participant URL: {typeof window !== "undefined" ? window.location.origin : ""}
            /q/{data.publicToken}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/q/${data.publicToken}`}
            target="_blank"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            rel="noreferrer"
          >
            Preview
          </Link>
          {data.status === "draft" && (
            <button
              type="button"
              disabled={busy || locked}
              onClick={() => publish()}
              className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Publish
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => archive()}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            Archive
          </button>
        </div>
      </div>

      {msg && (
        <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800">{msg}</p>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-zinc-900">Settings</h2>
        <form onSubmit={saveSettings} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-sm text-zinc-600">Title</span>
            <input
              name="title"
              defaultValue={data.title}
              disabled={locked}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-zinc-600">Questions per page (optional)</span>
            <input
              name="questionsPerPage"
              type="number"
              min={1}
              defaultValue={data.questionsPerPage ?? ""}
              disabled={locked}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-zinc-600">Time limit (seconds, optional)</span>
            <input
              name="timeLimitSeconds"
              type="number"
              min={30}
              defaultValue={data.timeLimitSeconds ?? ""}
              disabled={locked}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="allowMultipleCorrect"
              defaultChecked={data.allowMultipleCorrect}
              disabled={locked}
            />
            Allow multiple correct answers (per questionnaire)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isAllowedEmailsEnabled"
              defaultChecked={data.isAllowedEmailsEnabled}
              disabled={locked}
            />
            Restrict to allowed emails
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-zinc-600">Access type</span>
            <select
              name="accessType"
              defaultValue={data.accessType}
              disabled={locked}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            >
              <option value="public">Public link</option>
              <option value="email_only">Email only (same gating)</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-zinc-600">Results mode</span>
            <select
              name="resultsMode"
              defaultValue={data.resultsMode}
              disabled={locked}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            >
              <option value="full">Full (score + correct answers)</option>
              <option value="score_only">Score only</option>
            </select>
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-sm text-zinc-600">Allowed emails (comma-separated)</span>
            <textarea
              name="allowedEmails"
              defaultValue={allowedText}
              disabled={locked}
              rows={3}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy || locked}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save settings
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-zinc-900">Import from raw text</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Format: each question starts with <code className="rounded bg-zinc-100 px-1">Q:</code>,
          then lines <code className="rounded bg-zinc-100 px-1">- option</code>; append{" "}
          <code className="rounded bg-zinc-100 px-1">*</code> for correct answers.
        </p>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          disabled={locked || busy}
          rows={12}
          className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm disabled:bg-zinc-100"
          placeholder={`Q: What is 2+2?\n- 3\n- 4*\n- 5`}
        />
        <button
          type="button"
          disabled={locked || busy || !rawText.trim()}
          onClick={() => importRaw()}
          className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Replace all questions from text
        </button>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-zinc-900">Questions preview</h2>
          <Link
            href={`/admin/questionnaires/${id}/submissions`}
            className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            View submissions →
          </Link>
        </div>
        <ul className="mt-4 space-y-4">
          {data.questions.length === 0 && (
            <li className="text-sm text-zinc-500">No questions yet — import or publish after adding.</li>
          )}
          {data.questions.map((qu) => (
            <li key={qu.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
              <p className="font-medium text-zinc-900">{qu.title}</p>
              <ul className="mt-2 list-inside list-disc text-sm text-zinc-700">
                {qu.options.map((o) => (
                  <li key={o.id}>
                    {o.label}
                    {o.isCorrect ? " ✓" : ""}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

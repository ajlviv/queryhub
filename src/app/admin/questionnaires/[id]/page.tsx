"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/toast";

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

type QuestionEditorState = {
  title: string;
  optionsText: string;
  enabled: boolean;
  allowMultiple: boolean;
};

function toOptionsText(options: { label: string; isCorrect: boolean }[]) {
  return options.map((o) => `${o.isCorrect ? "* " : ""}${o.label}`).join("\n");
}

function parseOptionsText(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      label: line.startsWith("*") ? line.slice(1).trim() : line,
      isCorrect: line.startsWith("*"),
    }));
}

export default function QuestionnaireEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<QDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [allowedText, setAllowedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [questionEditors, setQuestionEditors] = useState<Record<string, QuestionEditorState>>(
    {},
  );
  const [newTitle, setNewTitle] = useState("");
  const [newOptionsText, setNewOptionsText] = useState("");
  const { showToast } = useToast();

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
      setQuestionEditors(
        Object.fromEntries(
          (j.questions as QDetail["questions"]).map((qu) => [
            qu.id,
            {
              title: qu.title,
              optionsText: toOptionsText(qu.options),
              enabled: qu.enabled,
              allowMultiple: qu.allowMultiple,
            },
          ]),
        ),
      );
      setError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  async function reloadQuestionnaire() {
    const r = await fetch(`/api/admin/questionnaires/${id}`, {
      credentials: "include",
    });
    const jj = await r.json().catch(() => ({}));
    if (r.ok) {
      setData(jj);
      setAllowedText((jj.allowedEmails as string[]).join(", "));
      setQuestionEditors(
        Object.fromEntries(
          (jj.questions as QDetail["questions"]).map((qu) => [
            qu.id,
            {
              title: qu.title,
              optionsText: toOptionsText(qu.options),
              enabled: qu.enabled,
              allowMultiple: qu.allowMultiple,
            },
          ]),
        ),
      );
    }
  }

  async function saveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    setBusy(true);
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
      showToast(j.error ?? "Save failed", "error");
      return;
    }
    showToast("Saved.", "success");
    await reloadQuestionnaire();
  }

  async function importRaw() {
    setBusy(true);
    const res = await fetch(`/api/admin/questionnaires/${id}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ raw: rawText }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      showToast(j.error ?? "Import failed", "error");
      return;
    }
    showToast("Imported.", "success");
    setRawText("");
    await reloadQuestionnaire();
  }

  async function publish() {
    setBusy(true);
    const res = await fetch(`/api/admin/questionnaires/${id}/publish`, {
      method: "POST",
      credentials: "include",
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      showToast(j.error ?? "Publish failed", "error");
      return;
    }
    showToast("Published.", "success");
    await reloadQuestionnaire();
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
      showToast(j.error ?? "Archive failed", "error");
      return;
    }
    router.push("/admin/questionnaires");
  }

  async function addQuestion() {
    if (!newTitle.trim()) {
      showToast("Question title is required", "error");
      return;
    }
    const options = parseOptionsText(newOptionsText);
    if (options.length < 2) {
      showToast("Add at least 2 options", "error");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/questionnaires/${id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: newTitle,
        options,
        allowMultiple: false,
        enabled: true,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      showToast(j.error ?? "Failed to add question", "error");
      return;
    }
    showToast("Question added.", "success");
    setNewTitle("");
    setNewOptionsText("");
    await reloadQuestionnaire();
  }

  async function saveQuestion(questionId: string) {
    const editor = questionEditors[questionId];
    if (!editor) return;
    const options = parseOptionsText(editor.optionsText);
    if (options.length < 2) {
      showToast("Each question needs at least 2 options", "error");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/questionnaires/${id}/questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: editor.title,
        enabled: editor.enabled,
        allowMultiple: editor.allowMultiple,
        options,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      showToast(j.error ?? "Failed to save question", "error");
      return;
    }
    showToast("Question saved.", "success");
    await reloadQuestionnaire();
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
            href={`/q/${data.publicToken}?preview=1`}
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
        <div className="mt-4 rounded-lg border border-dashed border-zinc-300 p-4">
          <h3 className="text-sm font-medium text-zinc-900">Add question manually</h3>
          <label className="mt-3 block space-y-1">
            <span className="text-xs text-zinc-600">Question title</span>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              disabled={busy || locked}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
              placeholder="Enter the question"
            />
          </label>
          <label className="mt-3 block space-y-1">
            <span className="text-xs text-zinc-600">Options (one per line, prefix correct with *)</span>
            <textarea
              value={newOptionsText}
              onChange={(e) => setNewOptionsText(e.target.value)}
              disabled={busy || locked}
              rows={5}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm disabled:bg-zinc-100"
              placeholder={"Paris\n* Berlin\nMadrid"}
            />
          </label>
          <button
            type="button"
            disabled={busy || locked}
            onClick={() => addQuestion()}
            className="mt-3 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Add question
          </button>
        </div>
        <ul className="mt-4 space-y-4">
          {data.questions.length === 0 && (
            <li className="text-sm text-zinc-500">No questions yet — import or publish after adding.</li>
          )}
          {data.questions.map((qu) => (
            <li key={qu.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
              <label className="block space-y-1">
                <span className="text-xs text-zinc-600">Question title</span>
                <input
                  value={questionEditors[qu.id]?.title ?? qu.title}
                  onChange={(e) =>
                    setQuestionEditors((prev) => ({
                      ...prev,
                      [qu.id]: {
                        ...(prev[qu.id] ?? {
                          title: qu.title,
                          optionsText: toOptionsText(qu.options),
                          enabled: qu.enabled,
                          allowMultiple: qu.allowMultiple,
                        }),
                        title: e.target.value,
                      },
                    }))
                  }
                  disabled={busy || locked}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
                />
              </label>
              <label className="mt-3 block space-y-1">
                <span className="text-xs text-zinc-600">Options (one per line, * = correct)</span>
                <textarea
                  value={questionEditors[qu.id]?.optionsText ?? toOptionsText(qu.options)}
                  onChange={(e) =>
                    setQuestionEditors((prev) => ({
                      ...prev,
                      [qu.id]: {
                        ...(prev[qu.id] ?? {
                          title: qu.title,
                          optionsText: toOptionsText(qu.options),
                          enabled: qu.enabled,
                          allowMultiple: qu.allowMultiple,
                        }),
                        optionsText: e.target.value,
                      },
                    }))
                  }
                  disabled={busy || locked}
                  rows={5}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm disabled:bg-zinc-100"
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={questionEditors[qu.id]?.enabled ?? qu.enabled}
                    onChange={(e) =>
                      setQuestionEditors((prev) => ({
                        ...prev,
                        [qu.id]: {
                          ...(prev[qu.id] ?? {
                            title: qu.title,
                            optionsText: toOptionsText(qu.options),
                            enabled: qu.enabled,
                            allowMultiple: qu.allowMultiple,
                          }),
                          enabled: e.target.checked,
                        },
                      }))
                    }
                    disabled={busy || locked}
                  />
                  Enabled
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={questionEditors[qu.id]?.allowMultiple ?? qu.allowMultiple}
                    onChange={(e) =>
                      setQuestionEditors((prev) => ({
                        ...prev,
                        [qu.id]: {
                          ...(prev[qu.id] ?? {
                            title: qu.title,
                            optionsText: toOptionsText(qu.options),
                            enabled: qu.enabled,
                            allowMultiple: qu.allowMultiple,
                          }),
                          allowMultiple: e.target.checked,
                        },
                      }))
                    }
                    disabled={busy || locked}
                  />
                  Allow multiple selections
                </label>
                <button
                  type="button"
                  disabled={busy || locked}
                  onClick={() => saveQuestion(qu.id)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
                >
                  Save question
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

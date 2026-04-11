"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Question = {
  id: string;
  title: string;
  allowMultiple: boolean;
  answers: { id: string; label: string }[];
};

type Payload = {
  id: string;
  title: string;
  questionsPerPage: number | null;
  timeLimitSeconds: number | null;
  resultsMode: string;
  questions: Question[];
};

export default function PublicQuestionnairePage() {
  const { token } = useParams<{ token: string }>();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"email" | "quiz" | "done">("email");
  const [answers, setAnswers] = useState<Record<string, Set<string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    scorePercent: number | null;
    breakdown?: {
      questionId: string;
      title: string;
      score: number;
      selectedLabels: string[];
      correctLabels?: string[];
    }[];
  } | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const searchParams = useSearchParams();
  const previewMode = searchParams.get("preview") === "1";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const search = previewMode ? "?preview=1" : "";
      const res = await fetch(`/api/public/questionnaires/${token}${search}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!cancelled) setLoadError(j.error ?? "Not found");
        return;
      }
      if (!cancelled) setPayload(j);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, previewMode]);

  const pageSize = payload?.questionsPerPage ?? payload?.questions.length ?? 1;
  const [pageIndex, setPageIndex] = useState(0);

  const pages = useMemo(() => {
    if (!payload) return [] as Question[][];
    const qs = payload.questions;
    if (!pageSize || pageSize >= qs.length) return [qs];
    const out: Question[][] = [];
    for (let i = 0; i < qs.length; i += pageSize) {
      out.push(qs.slice(i, i + pageSize));
    }
    return out;
  }, [payload, pageSize]);

  async function start() {
    setSubmitError(null);
    if (!previewMode) {
      const res = await fetch(`/api/public/questionnaires/${token}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(j.error ?? "Could not start");
        return;
      }
      setPhase("quiz");
      setPageIndex(0);
      const init: Record<string, Set<string>> = {};
      payload?.questions.forEach((q) => {
        init[q.id] = new Set();
      });
      setAnswers(init);
      const startAtMs = new Date(j.startedAt).getTime();
      setStartedAt(startAtMs);
      if (payload?.timeLimitSeconds != null) {
        setTimeLeft(
          Math.max(
            0,
            payload.timeLimitSeconds - Math.floor((Date.now() - startAtMs) / 1000),
          ),
        );
      } else {
        setTimeLeft(null);
      }
      setAutoSubmitted(false);
    } else {
      // Preview mode: skip API call
      setPhase("quiz");
      setPageIndex(0);
      const init: Record<string, Set<string>> = {};
      payload?.questions.forEach((q) => {
        init[q.id] = new Set();
      });
      setAnswers(init);
      const startAtMs = Date.now();
      setStartedAt(startAtMs);
      if (payload?.timeLimitSeconds != null) {
        setTimeLeft(payload.timeLimitSeconds);
      } else {
        setTimeLeft(null);
      }
      setAutoSubmitted(false);
    }
  }

  function toggleAnswer(qid: string, aid: string, allowMultiple: boolean) {
    setAnswers((prev) => {
      const next = { ...prev, [qid]: new Set(prev[qid]) };
      if (allowMultiple) {
        if (next[qid].has(aid)) next[qid].delete(aid);
        else next[qid].add(aid);
      } else {
        next[qid] = new Set([aid]);
      }
      return next;
    });
  }

  useEffect(() => {
    if (!payload?.timeLimitSeconds || phase !== "quiz" || startedAt == null) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, payload.timeLimitSeconds! - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0 && !autoSubmitted) {
        setAutoSubmitted(true);
        submit();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [autoSubmitted, phase, payload?.timeLimitSeconds, startedAt, submit]);

  async function submit() {
    if (!payload) return;
    setSubmitError(null);
    const body: Record<string, string[]> = {};
    for (const q of payload.questions) {
      body[q.id] = [...(answers[q.id] ?? new Set())];
    }
    const res = await fetch(`/api/public/questionnaires/${token}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ answers: body }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSubmitError(j.error ?? "Submit failed");
      return;
    }
    setResult(j);
    setPhase("done");
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-red-600">{loadError}</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-zinc-600">
        Loading…
      </div>
    );
  }

  if (phase === "email") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-semibold text-zinc-900">{payload.title}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Enter your email to begin. The timer (if any) starts after you continue.
        </p>
        <label className="mt-6 block space-y-1">
          <span className="text-sm text-zinc-600">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        {submitError && <p className="mt-2 text-sm text-red-600">{submitError}</p>}
        <button
          type="button"
          onClick={() => start()}
          className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Continue
        </button>
      </div>
    );
  }

  if (phase === "done" && result) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Thank you</h1>
        {result.scorePercent != null && (
          <p className="text-lg text-zinc-800">
            Score: <strong>{result.scorePercent.toFixed(1)}%</strong>
          </p>
        )}
        {result.breakdown && (
          <ul className="space-y-4">
            {result.breakdown.map((b) => (
              <li key={b.questionId} className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
                <p className="font-medium text-zinc-900">{b.title}</p>
                <p className="mt-1 text-zinc-600">
                  Your answers: {b.selectedLabels.join(", ") || "—"}
                </p>
                {b.correctLabels && (
                  <p className="mt-1 text-zinc-600">
                    Correct: {b.correctLabels.join(", ")}
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-500">
                  Question score: {(b.score * 100).toFixed(0)}%
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const currentQuestions = pages[pageIndex] ?? [];

  return (
    <div className="mx-auto max-w-lg px-4 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">{payload.title}</h1>
        {payload.timeLimitSeconds != null && (
          <p className="text-sm text-zinc-500">
            {timeLeft != null
              ? `Time remaining: ${timeLeft}s`
              : `Time limit: ${payload.timeLimitSeconds}s from start`}
          </p>
        )}
      </div>

      {currentQuestions.map((q) => (
        <fieldset key={q.id} className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4">
          <legend className="px-1 text-sm font-medium text-zinc-900">{q.title}</legend>
          <div className="space-y-2">
            {q.answers.map((a) => {
              const checked = answers[q.id]?.has(a.id) ?? false;
              const type = q.allowMultiple ? "checkbox" : "radio";
              return (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800"
                >
                  <input
                    type={type}
                    name={q.allowMultiple ? `${q.id}-${a.id}` : q.id}
                    checked={checked}
                    onChange={() => toggleAnswer(q.id, a.id, q.allowMultiple)}
                  />
                  {a.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <div className="flex flex-wrap gap-2">
        {pageIndex > 0 && (
          <button
            type="button"
            onClick={() => setPageIndex((i) => i - 1)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm"
          >
            Previous
          </button>
        )}
        {pageIndex < pages.length - 1 && (
          <button
            type="button"
            onClick={() => setPageIndex((i) => i + 1)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            Next
          </button>
        )}
        {pageIndex === pages.length - 1 && (
          <button
            type="button"
            onClick={() => submit()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
          >
            Submit
          </button>
        )}
      </div>
    </div>
  );
}

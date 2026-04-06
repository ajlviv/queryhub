import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { maxQuestionnairesForTier } from "@/lib/tiers";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { parseRawQuestionnaireText, validateParsedAgainstSettings } from "@/lib/parse-raw";
import { questionScore, totalScorePercent } from "@/lib/scoring";

export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export async function assertAdminOwnsQuestionnaire(
  companyId: string,
  questionnaireId: string,
) {
  const q = await prisma.questionnaire.findFirst({
    where: { id: questionnaireId, companyId },
  });
  if (!q) throw new ServiceError(404, "Questionnaire not found");
  return q;
}

export function assertUnlocked(q: { lockedAt: Date | null }) {
  if (q.lockedAt) {
    throw new ServiceError(
      409,
      "Questionnaire is locked after participants have started",
    );
  }
}

export async function enforceQuestionnaireCreationLimit(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new ServiceError(400, "Company not found");
  const max = maxQuestionnairesForTier(company.tier);
  const count = await prisma.questionnaire.count({
    where: { companyId, status: { not: "archived" } },
  });
  if (count >= max) {
    throw new ServiceError(
      403,
      `Questionnaire limit reached for your tier (${max}). Upgrade to add more.`,
    );
  }
}

const publicInclude = {
  questions: {
    where: { enabled: true },
    orderBy: { position: "asc" as const },
    include: {
      translations: true,
      answerOptions: {
        orderBy: { position: "asc" as const },
        include: { translations: true },
      },
    },
  },
} satisfies Prisma.QuestionnaireInclude;

export async function getPublicQuestionnairePayload(
  publicToken: string,
  locale: string,
) {
  const q = await prisma.questionnaire.findUnique({
    where: { publicToken },
    include: publicInclude,
  });
  if (!q || q.status === "draft" || q.status === "archived") {
    throw new ServiceError(404, "Questionnaire not available");
  }

  const loc = locale || q.defaultLocale;
  const questions = q.questions.map((question) => {
    const t =
      question.translations.find((x) => x.locale === loc) ??
      question.translations[0];
    const title = t?.title ?? "(untitled)";
    const answers = question.answerOptions.map((opt) => {
      const ot =
        opt.translations.find((x) => x.locale === loc) ??
        opt.translations[0];
      return {
        id: opt.id,
        label: ot?.label ?? "",
      };
    });
    return {
      id: question.id,
      title,
      allowMultiple: question.allowMultiple,
      answers,
    };
  });

  return {
    id: q.id,
    title: q.title,
    questionsPerPage: q.questionsPerPage,
    timeLimitSeconds: q.timeLimitSeconds,
    resultsMode: q.resultsMode,
    questions,
  };
}

export async function importParsedQuestions(
  questionnaireId: string,
  companyId: string,
  raw: string,
) {
  const q = await assertAdminOwnsQuestionnaire(companyId, questionnaireId);
  assertUnlocked(q);

  const parsed = parseRawQuestionnaireText(raw);
  validateParsedAgainstSettings(parsed, q.allowMultipleCorrect);

  await prisma.$transaction(async (tx) => {
    await tx.question.deleteMany({ where: { questionnaireId } });

    let pos = 0;
    for (const pq of parsed) {
      const correctCount = pq.options.filter((o) => o.correct).length;
      const allowMultiple =
        correctCount > 1 || q.allowMultipleCorrect === true;

      const question = await tx.question.create({
        data: {
          questionnaireId,
          position: pos++,
          enabled: true,
          allowMultiple,
          translations: {
            create: {
              locale: q.defaultLocale,
              title: pq.title,
            },
          },
        },
      });

      let oPos = 0;
      for (const opt of pq.options) {
        await tx.answerOption.create({
          data: {
            questionId: question.id,
            position: oPos++,
            isCorrect: opt.correct,
            translations: {
              create: {
                locale: q.defaultLocale,
                label: opt.label,
              },
            },
          },
        });
      }
    }
  });
}

export async function submitAnswers(
  submissionId: string,
  publicToken: string,
  emailNormalized: string,
  answers: Record<string, string[]>,
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      questionnaire: {
        include: {
          questions: {
            where: { enabled: true },
            include: { answerOptions: true },
          },
        },
      },
    },
  });

  if (!submission) throw new ServiceError(404, "Submission not found");
  if (submission.questionnaire.publicToken !== publicToken) {
    throw new ServiceError(403, "Invalid session");
  }
  if (submission.participantEmailNormalized !== emailNormalized) {
    throw new ServiceError(403, "Invalid session");
  }
  if (submission.status !== "in_progress") {
    throw new ServiceError(409, "Already submitted");
  }

  const qn = submission.questionnaire;
  if (qn.timeLimitSeconds != null) {
    const elapsed = (Date.now() - submission.startedAt.getTime()) / 1000;
    if (elapsed > qn.timeLimitSeconds) {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: "expired" },
      });
      throw new ServiceError(409, "Time limit exceeded");
    }
  }

  const enabledQuestions = qn.questions;
  const perQuestion: number[] = [];

  await prisma.$transaction(async (tx) => {
    await tx.submissionAnswer.deleteMany({ where: { submissionId } });

    for (const question of enabledQuestions) {
      const selected = new Set(answers[question.id] ?? []);
      const correctIds = new Set(
        question.answerOptions.filter((o) => o.isCorrect).map((o) => o.id),
      );

      if (!question.allowMultiple && selected.size > 1) {
        throw new ServiceError(400, "Too many selections for a single-choice question");
      }

      for (const aid of selected) {
        const opt = question.answerOptions.find((o) => o.id === aid);
        if (!opt) {
          throw new ServiceError(400, "Invalid answer option");
        }
        await tx.submissionAnswer.create({
          data: {
            submissionId,
            questionId: question.id,
            answerOptionId: opt.id,
            isCorrectSnapshot: opt.isCorrect,
          },
        });
      }

      perQuestion.push(questionScore(correctIds, selected));
    }

    const score = totalScorePercent(perQuestion);

    await tx.submission.update({
      where: { id: submissionId },
      data: {
        status: "submitted",
        submittedAt: new Date(),
        score,
      },
    });
  });

  const updated = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { questionnaire: true, answers: true },
  });

  if (!updated) throw new ServiceError(500, "Submit failed");

  const loc = updated.questionnaire.defaultLocale;
  const mode = updated.questionnaire.resultsMode;

  if (mode === "score_only") {
    return {
      scorePercent: updated.score,
      resultsMode: mode,
    };
  }

  const questionsForBreakdown = await prisma.question.findMany({
    where: { questionnaireId: qn.id, enabled: true },
    orderBy: { position: "asc" },
    include: {
      translations: true,
      answerOptions: { include: { translations: true } },
    },
  });

  const breakdown = questionsForBreakdown.map((question) => {
    const selectedIds = new Set(
      updated.answers
        .filter((a) => a.questionId === question.id)
        .map((a) => a.answerOptionId),
    );
    const correctIds = question.answerOptions
      .filter((o) => o.isCorrect)
      .map((o) => o.id);
    const qt =
      question.translations.find((t) => t.locale === loc) ??
      question.translations[0];
    const title = qt?.title ?? "";

    const selectedLabels = question.answerOptions
      .filter((o) => selectedIds.has(o.id))
      .map((o) => {
        const tr =
          o.translations.find((t) => t.locale === loc) ?? o.translations[0];
        return tr?.label ?? "";
      });

    const correctLabels = question.answerOptions
      .filter((o) => o.isCorrect)
      .map((o) => {
        const tr =
          o.translations.find((t) => t.locale === loc) ?? o.translations[0];
        return tr?.label ?? "";
      });

    const partial = questionScore(new Set(correctIds), selectedIds);

    return {
      questionId: question.id,
      title,
      score: partial,
      selectedLabels,
      correctLabels,
    };
  });

  return {
    scorePercent: updated.score,
    resultsMode: mode,
    breakdown,
  };
}

export async function startOrResumeSubmission(
  publicToken: string,
  email: string,
) {
  const norm = normalizeEmail(email);
  if (!isValidEmail(norm)) {
    throw new ServiceError(400, "Invalid email");
  }

  const q = await prisma.questionnaire.findUnique({
    where: { publicToken },
    include: { allowedEmails: true },
  });

  if (!q || q.status === "draft" || q.status === "archived") {
    throw new ServiceError(404, "Questionnaire not available");
  }

  if (q.isAllowedEmailsEnabled) {
    const allowed = new Set(q.allowedEmails.map((e) => e.emailNormalized));
    if (allowed.size === 0) {
      throw new ServiceError(
        400,
        "Allowed emails are enabled but none are configured",
      );
    }
    if (!allowed.has(norm)) {
      throw new ServiceError(403, "This email is not on the allowed list");
    }
  }

  const existing = await prisma.submission.findUnique({
    where: {
      questionnaireId_participantEmailNormalized: {
        questionnaireId: q.id,
        participantEmailNormalized: norm,
      },
    },
  });

  if (existing?.status === "submitted") {
    throw new ServiceError(409, "You have already submitted");
  }
  if (existing?.status === "expired") {
    throw new ServiceError(409, "Session expired");
  }

  if (existing?.status === "in_progress") {
    return { submission: existing, questionnaireId: q.id };
  }

  const submission = await prisma.$transaction(async (tx) => {
    const sub = await tx.submission.create({
      data: {
        questionnaireId: q.id,
        participantEmailNormalized: norm,
        status: "in_progress",
      },
    });

    await tx.questionnaire.updateMany({
      where: { id: q.id, lockedAt: null },
      data: { lockedAt: new Date(), status: "locked" },
    });

    return sub;
  });

  return { submission, questionnaireId: q.id };
}

export async function replaceAllowedEmails(
  questionnaireId: string,
  companyId: string,
  emails: string[],
) {
  const q = await assertAdminOwnsQuestionnaire(companyId, questionnaireId);
  assertUnlocked(q);

  const normalized = [...new Set(emails.map(normalizeEmail).filter(Boolean))];

  await prisma.$transaction(async (tx) => {
    await tx.questionnaireAllowedEmail.deleteMany({ where: { questionnaireId } });
    for (const emailNormalized of normalized) {
      await tx.questionnaireAllowedEmail.create({
        data: { questionnaireId, emailNormalized },
      });
    }
  });
}

import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import {
  assertAdminOwnsQuestionnaire,
  assertUnlocked,
  replaceAllowedEmails,
  ServiceError,
} from "@/lib/questionnaire-service";
import { z } from "zod";
import { isValidEmail, normalizeEmail } from "@/lib/email";

const patchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  questionsPerPage: z.number().int().min(1).max(100).nullable().optional(),
  timeLimitSeconds: z.number().int().min(30).max(86400).nullable().optional(),
  allowMultipleCorrect: z.boolean().optional(),
  isAllowedEmailsEnabled: z.boolean().optional(),
  accessType: z.enum(["public", "email_only"]).optional(),
  resultsMode: z.enum(["full", "score_only"]).optional(),
  allowedEmails: z.array(z.string()).optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await ctx.params;

  try {
    await assertAdminOwnsQuestionnaire(session.companyId, id);
    const full = await prisma.questionnaire.findUnique({
      where: { id },
      include: {
        allowedEmails: true,
        questions: {
          orderBy: { position: "asc" },
          include: {
            translations: true,
            answerOptions: {
              orderBy: { position: "asc" },
              include: { translations: true },
            },
          },
        },
      },
    });
    if (!full) return jsonError("Not found", 404);

    return jsonOk({
      id: full.id,
      title: full.title,
      publicToken: full.publicToken,
      status: full.status,
      lockedAt: full.lockedAt,
      questionsPerPage: full.questionsPerPage,
      timeLimitSeconds: full.timeLimitSeconds,
      allowMultipleCorrect: full.allowMultipleCorrect,
      isAllowedEmailsEnabled: full.isAllowedEmailsEnabled,
      accessType: full.accessType,
      resultsMode: full.resultsMode,
      defaultLocale: full.defaultLocale,
      allowedEmails: full.allowedEmails.map((e) => e.emailNormalized),
      questions: full.questions.map((qu) => ({
        id: qu.id,
        position: qu.position,
        enabled: qu.enabled,
        allowMultiple: qu.allowMultiple,
        title: qu.translations[0]?.title ?? "",
        options: qu.answerOptions.map((o) => ({
          id: o.id,
          position: o.position,
          isCorrect: o.isCorrect,
          label: o.translations[0]?.label ?? "",
        })),
      })),
    });
  } catch (e) {
    if (e instanceof ServiceError) {
      return jsonError(e.message, e.status);
    }
    throw e;
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return jsonError("Invalid body", 400);

  try {
    const q = await assertAdminOwnsQuestionnaire(session.companyId, id);
    assertUnlocked(q);

    const { allowedEmails, ...rest } = parsed.data;

    if (allowedEmails !== undefined) {
      for (const em of allowedEmails) {
        const n = normalizeEmail(em);
        if (!isValidEmail(n)) {
          return jsonError(`Invalid email in list: ${em}`, 400);
        }
      }
      await replaceAllowedEmails(id, session.companyId, allowedEmails);
    }

    const data: Record<string, unknown> = {};
    if (rest.title !== undefined) data.title = rest.title.trim();
    if (rest.questionsPerPage !== undefined)
      data.questionsPerPage = rest.questionsPerPage;
    if (rest.timeLimitSeconds !== undefined)
      data.timeLimitSeconds = rest.timeLimitSeconds;
    if (rest.allowMultipleCorrect !== undefined)
      data.allowMultipleCorrect = rest.allowMultipleCorrect;
    if (rest.isAllowedEmailsEnabled !== undefined)
      data.isAllowedEmailsEnabled = rest.isAllowedEmailsEnabled;
    if (rest.accessType !== undefined) data.accessType = rest.accessType;
    if (rest.resultsMode !== undefined) data.resultsMode = rest.resultsMode;

    if (Object.keys(data).length > 0) {
      await prisma.questionnaire.update({ where: { id }, data: data as object });
    }

    const updated = await prisma.questionnaire.findUnique({ where: { id } });
    return jsonOk(updated);
  } catch (e) {
    if (e instanceof ServiceError) {
      return jsonError(e.message, e.status);
    }
    throw e;
  }
}

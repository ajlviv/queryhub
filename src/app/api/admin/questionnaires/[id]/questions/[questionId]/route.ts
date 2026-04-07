import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import {
  assertAdminOwnsQuestionnaire,
  assertUnlocked,
  ServiceError,
} from "@/lib/questionnaire-service";
import { z } from "zod";

const updateQuestionSchema = z.object({
  title: z.string().trim().min(1).max(500),
  enabled: z.boolean(),
  allowMultiple: z.boolean(),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(500),
        isCorrect: z.boolean(),
      }),
    )
    .min(2),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; questionId: string }> },
) {
  const session = await getAdminSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { id: questionnaireId, questionId } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = updateQuestionSchema.safeParse(json);
  if (!parsed.success) return jsonError("Invalid body", 400);

  try {
    const questionnaire = await assertAdminOwnsQuestionnaire(
      session.companyId,
      questionnaireId,
    );
    assertUnlocked(questionnaire);

    const question = await prisma.question.findFirst({
      where: { id: questionId, questionnaireId },
      select: { id: true },
    });
    if (!question) return jsonError("Question not found", 404);

    const correctCount = parsed.data.options.filter((o) => o.isCorrect).length;
    if (correctCount < 1) {
      return jsonError("At least one option must be correct", 400);
    }
    if (!questionnaire.allowMultipleCorrect && correctCount > 1) {
      return jsonError(
        "This questionnaire allows only one correct option per question",
        400,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.questionTranslation.deleteMany({ where: { questionId } });
      await tx.answerOption.deleteMany({ where: { questionId } });

      await tx.question.update({
        where: { id: questionId },
        data: {
          enabled: parsed.data.enabled,
          allowMultiple: parsed.data.allowMultiple || correctCount > 1,
          translations: {
            create: {
              locale: questionnaire.defaultLocale,
              title: parsed.data.title,
            },
          },
          answerOptions: {
            create: parsed.data.options.map((opt, idx) => ({
              position: idx,
              isCorrect: opt.isCorrect,
              translations: {
                create: {
                  locale: questionnaire.defaultLocale,
                  label: opt.label,
                },
              },
            })),
          },
        },
      });
    });

    const updated = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        translations: true,
        answerOptions: { orderBy: { position: "asc" }, include: { translations: true } },
      },
    });

    return jsonOk(updated);
  } catch (e) {
    if (e instanceof ServiceError) {
      return jsonError(e.message, e.status);
    }
    throw e;
  }
}

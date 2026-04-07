import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import {
  assertAdminOwnsQuestionnaire,
  assertUnlocked,
  ServiceError,
} from "@/lib/questionnaire-service";
import { z } from "zod";

const createQuestionSchema = z.object({
  title: z.string().trim().min(1).max(500),
  enabled: z.boolean().optional(),
  allowMultiple: z.boolean().optional(),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(500),
        isCorrect: z.boolean(),
      }),
    )
    .min(2),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { id: questionnaireId } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = createQuestionSchema.safeParse(json);
  if (!parsed.success) return jsonError("Invalid body", 400);

  try {
    const questionnaire = await assertAdminOwnsQuestionnaire(
      session.companyId,
      questionnaireId,
    );
    assertUnlocked(questionnaire);

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

    const maxPos = await prisma.question.aggregate({
      where: { questionnaireId },
      _max: { position: true },
    });
    const nextPosition = (maxPos._max.position ?? -1) + 1;

    const created = await prisma.question.create({
      data: {
        questionnaireId,
        position: nextPosition,
        enabled: parsed.data.enabled ?? true,
        allowMultiple:
          parsed.data.allowMultiple ??
          (correctCount > 1 ||
          questionnaire.allowMultipleCorrect),
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
      include: {
        translations: true,
        answerOptions: { orderBy: { position: "asc" }, include: { translations: true } },
      },
    });

    return jsonOk(created);
  } catch (e) {
    if (e instanceof ServiceError) {
      return jsonError(e.message, e.status);
    }
    throw e;
  }
}

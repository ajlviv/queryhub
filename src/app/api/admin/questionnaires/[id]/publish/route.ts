import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import {
  assertAdminOwnsQuestionnaire,
  assertUnlocked,
  ServiceError,
} from "@/lib/questionnaire-service";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await ctx.params;

  try {
    const q = await assertAdminOwnsQuestionnaire(session.companyId, id);
    assertUnlocked(q);

    if (q.status !== "draft") {
      return jsonError("Only draft questionnaires can be published", 400);
    }

    const count = await prisma.question.count({ where: { questionnaireId: id } });
    if (count === 0) {
      return jsonError("Add at least one question before publishing", 400);
    }

    const updated = await prisma.questionnaire.update({
      where: { id },
      data: { status: "published" },
    });

    return jsonOk(updated);
  } catch (e) {
    if (e instanceof ServiceError) {
      return jsonError(e.message, e.status);
    }
    throw e;
  }
}

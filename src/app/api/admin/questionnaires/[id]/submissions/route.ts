import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { assertAdminOwnsQuestionnaire, ServiceError } from "@/lib/questionnaire-service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await ctx.params;

  try {
    await assertAdminOwnsQuestionnaire(session.companyId, id);

    const rows = await prisma.submission.findMany({
      where: { questionnaireId: id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return jsonOk({
      items: rows.map((s) => ({
        id: s.id,
        email: s.participantEmailNormalized,
        status: s.status,
        score: s.score,
        startedAt: s.startedAt,
        submittedAt: s.submittedAt,
      })),
    });
  } catch (e) {
    if (e instanceof ServiceError) {
      return jsonError(e.message, e.status);
    }
    throw e;
  }
}

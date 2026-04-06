import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { assertAdminOwnsQuestionnaire, ServiceError } from "@/lib/questionnaire-service";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await ctx.params;

  try {
    await assertAdminOwnsQuestionnaire(session.companyId, id);

    const updated = await prisma.questionnaire.update({
      where: { id },
      data: { status: "archived" },
    });

    return jsonOk(updated);
  } catch (e) {
    if (e instanceof ServiceError) {
      return jsonError(e.message, e.status);
    }
    throw e;
  }
}

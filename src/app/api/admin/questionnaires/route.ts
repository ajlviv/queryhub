import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { enforceQuestionnaireCreationLimit, ServiceError } from "@/lib/questionnaire-service";
import { z } from "zod";

const tokenGen = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyz",
  24,
);

const createSchema = z.object({
  title: z.string().min(1).max(500),
});

export async function GET() {
  const session = await getAdminSession();
  if (!session) return jsonError("Unauthorized", 401);

  const list = await prisma.questionnaire.findMany({
    where: { companyId: session.companyId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      _count: { select: { questions: true, submissions: true } },
    },
  });

  return jsonOk({
    items: list.map((q) => ({
      id: q.id,
      title: q.title,
      publicToken: q.publicToken,
      status: q.status,
      lockedAt: q.lockedAt,
      questionCount: q._count.questions,
      submissionCount: q._count.submissions,
      updatedAt: q.updatedAt,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return jsonError("Unauthorized", 401);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return jsonError("Invalid body", 400);

  try {
    await enforceQuestionnaireCreationLimit(session.companyId);
  } catch (e) {
    if (e instanceof ServiceError) {
      return jsonError(e.message, e.status);
    }
    throw e;
  }

  const q = await prisma.questionnaire.create({
    data: {
      companyId: session.companyId,
      title: parsed.data.title.trim(),
      publicToken: tokenGen(),
      createdById: session.adminId,
    },
  });

  return jsonOk({
    id: q.id,
    title: q.title,
    publicToken: q.publicToken,
    status: q.status,
  });
}

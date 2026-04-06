import { getAdminSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import {
  importParsedQuestions,
  ServiceError,
} from "@/lib/questionnaire-service";
import { z } from "zod";

const bodySchema = z.object({
  raw: z.string(),
});

export async function POST(
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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return jsonError("Invalid body", 400);

  try {
    await importParsedQuestions(id, session.companyId, parsed.data.raw);
    return jsonOk({ ok: true });
  } catch (e) {
    if (e instanceof ServiceError) {
      return jsonError(e.message, e.status);
    }
    if (e instanceof Error) {
      return jsonError(e.message, 400);
    }
    throw e;
  }
}

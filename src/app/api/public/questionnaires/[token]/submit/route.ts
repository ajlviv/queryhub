import { z } from "zod";
import { getParticipantSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import {
  submitAnswers,
  ServiceError,
} from "@/lib/questionnaire-service";

const bodySchema = z.object({
  answers: z.record(z.string(), z.array(z.string())),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const session = await getParticipantSession();
  if (!session || session.publicToken !== token) {
    return jsonError("Start the questionnaire first", 401);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return jsonError("Invalid body", 400);

  try {
    const result = await submitAnswers(
      session.submissionId,
      token,
      session.emailNormalized,
      parsed.data.answers,
    );
    return jsonOk(result);
  } catch (e) {
    if (e instanceof ServiceError) {
      return jsonError(e.message, e.status);
    }
    throw e;
  }
}

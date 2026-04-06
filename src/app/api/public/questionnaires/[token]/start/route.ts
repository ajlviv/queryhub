import { z } from "zod";
import {
  startOrResumeSubmission,
  ServiceError,
} from "@/lib/questionnaire-service";
import { signParticipantSession, setParticipantCookie } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

const bodySchema = z.object({
  email: z.string(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return jsonError("Invalid body", 400);

  try {
    const { submission } = await startOrResumeSubmission(
      token,
      parsed.data.email,
    );

    const jwt = await signParticipantSession({
      submissionId: submission.id,
      publicToken: token,
      emailNormalized: submission.participantEmailNormalized,
    });
    await setParticipantCookie(jwt);

    return jsonOk({
      submissionId: submission.id,
      startedAt: submission.startedAt,
    });
  } catch (e) {
    if (e instanceof ServiceError) {
      return jsonError(e.message, e.status);
    }
    throw e;
  }
}

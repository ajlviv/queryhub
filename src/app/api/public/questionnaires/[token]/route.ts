import { jsonError, jsonOk } from "@/lib/http";
import {
  getPublicQuestionnairePayload,
  ServiceError,
} from "@/lib/questionnaire-service";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") ?? "en";
  const preview = url.searchParams.get("preview") === "1";

  try {
    const payload = await getPublicQuestionnairePayload(token, locale, preview);
    return jsonOk(payload);
  } catch (e) {
    if (e instanceof ServiceError) {
      return jsonError(e.message, e.status);
    }
    throw e;
  }
}

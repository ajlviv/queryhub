import { clearAdminCookie } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

export async function POST() {
  await clearAdminCookie();
  return jsonOk({ ok: true });
}

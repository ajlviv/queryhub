import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

const updateSchema = z.object({
  tier: z.enum(["default", "basic", "pro"]),
});

export async function GET() {
  const session = await getAdminSession();
  if (!session) return jsonError("Unauthorized", 401);

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { id: true, name: true, tier: true },
  });

  if (!company) return jsonError("Company not found", 404);
  return jsonOk({ company });
}

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) return jsonError("Unauthorized", 401);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) return jsonError("Invalid body", 400);

  const company = await prisma.company.update({
    where: { id: session.companyId },
    data: { tier: parsed.data.tier },
    select: { id: true, name: true, tier: true },
  });

  return jsonOk({ company });
}

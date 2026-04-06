import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizeEmail, isValidEmail } from "@/lib/email";
import { signAdminSession, setAdminCookie } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

const bodySchema = z.object({
  email: z.string(),
  password: z.string(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("Invalid body", 400);
  }

  const norm = normalizeEmail(parsed.data.email);
  if (!isValidEmail(norm)) {
    return jsonError("Invalid credentials", 401);
  }

  const admin = await prisma.adminUser.findUnique({ where: { email: norm } });
  if (!admin) {
    return jsonError("Invalid credentials", 401);
  }

  const ok = await bcrypt.compare(parsed.data.password, admin.passwordHash);
  if (!ok) {
    return jsonError("Invalid credentials", 401);
  }

  const token = await signAdminSession({
    adminId: admin.id,
    companyId: admin.companyId,
  });
  await setAdminCookie(token);

  const company = await prisma.company.findUnique({ where: { id: admin.companyId } });

  return jsonOk({
    admin: { id: admin.id, email: admin.email },
    company: company
      ? { id: company.id, name: company.name, tier: company.tier }
      : null,
  });
}

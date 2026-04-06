import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizeEmail, isValidEmail } from "@/lib/email";
import { signAdminSession, setAdminCookie } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

const bodySchema = z.object({
  email: z.string(),
  password: z.string().min(8),
  companyName: z.string().min(1).max(200),
  tier: z.enum(["default", "basic", "pro"]).optional(),
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

  const { email, password, companyName, tier } = parsed.data;
  const norm = normalizeEmail(email);
  if (!isValidEmail(norm)) {
    return jsonError("Invalid email", 400);
  }

  const existing = await prisma.adminUser.findUnique({ where: { email: norm } });
  if (existing) {
    return jsonError("Email already registered", 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const company = await prisma.company.create({
    data: { name: companyName.trim(), tier: tier ?? "default" },
  });

  const admin = await prisma.adminUser.create({
    data: {
      companyId: company.id,
      email: norm,
      passwordHash,
    },
  });

  const token = await signAdminSession({
    adminId: admin.id,
    companyId: company.id,
  });
  await setAdminCookie(token);

  return jsonOk({
    admin: { id: admin.id, email: admin.email },
    company: { id: company.id, name: company.name, tier: company.tier },
  });
}

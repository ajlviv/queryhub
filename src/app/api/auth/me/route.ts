import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
    include: { company: true },
  });

  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  return jsonOk({
    admin: { id: admin.id, email: admin.email },
    company: {
      id: admin.company.id,
      name: admin.company.name,
      tier: admin.company.tier,
    },
  });
}

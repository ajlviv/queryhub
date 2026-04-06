import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "admin_session";
const PARTICIPANT_COOKIE = "participant_session";

function secretKey() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("Set AUTH_SECRET in .env (at least 16 characters)");
  }
  return new TextEncoder().encode(s);
}

export type AdminSession = { adminId: string; companyId: string };
export type ParticipantSession = {
  submissionId: string;
  publicToken: string;
  emailNormalized: string;
};

export async function signAdminSession(payload: AdminSession): Promise<string> {
  return new SignJWT({
    adminId: payload.adminId,
    companyId: payload.companyId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifyAdminSession(
  token: string,
): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const adminId = String(payload.adminId ?? "");
    const companyId = String(payload.companyId ?? "");
    if (!adminId || !companyId) return null;
    return { adminId, companyId };
  } catch {
    return null;
  }
}

export async function signParticipantSession(
  payload: ParticipantSession,
): Promise<string> {
  return new SignJWT({
    submissionId: payload.submissionId,
    publicToken: payload.publicToken,
    emailNormalized: payload.emailNormalized,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secretKey());
}

export async function verifyParticipantSession(
  token: string,
): Promise<ParticipantSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const submissionId = String(payload.submissionId ?? "");
    const publicToken = String(payload.publicToken ?? "");
    const emailNormalized = String(payload.emailNormalized ?? "");
    if (!submissionId || !publicToken || !emailNormalized) return null;
    return { submissionId, publicToken, emailNormalized };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const c = jar.get(ADMIN_COOKIE)?.value;
  if (!c) return null;
  return verifyAdminSession(c);
}

export async function setAdminCookie(token: string) {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAdminCookie() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function setParticipantCookie(token: string) {
  const jar = await cookies();
  jar.set(PARTICIPANT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function clearParticipantCookie() {
  const jar = await cookies();
  jar.set(PARTICIPANT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getParticipantSession(): Promise<ParticipantSession | null> {
  const jar = await cookies();
  const c = jar.get(PARTICIPANT_COOKIE)?.value;
  if (!c) return null;
  return verifyParticipantSession(c);
}

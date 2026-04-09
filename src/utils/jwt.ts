import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

type AccessTokenPayload = {
  sub: string;
  role: Role;
  type: "access";
};

type TwoFATempPayload = {
  sub: string;
  role: Role;
  type: "2fa_pending";
};

const jwtSecret = process.env.JWT_SECRET ?? "dev-only-secret-change-me";

export function signAccessToken(user: { id: string; role: Role }) {
  const payload: AccessTokenPayload = {
    sub: user.id,
    role: user.role,
    type: "access",
  };
  return jwt.sign(payload, jwtSecret, { expiresIn: "1d" });
}

export function signTwoFATempToken(user: { id: string; role: Role }) {
  const payload: TwoFATempPayload = {
    sub: user.id,
    role: user.role,
    type: "2fa_pending",
  };
  return jwt.sign(payload, jwtSecret, { expiresIn: "10m" });
}

export function verifyAccessToken(token: string): { userId: string; role: Role } | null {
  try {
    const decoded = jwt.verify(token, jwtSecret) as AccessTokenPayload;
    if (decoded.type !== "access") return null;
    return { userId: decoded.sub, role: decoded.role };
  } catch {
    return null;
  }
}

export function verifyTwoFATempToken(token: string): { userId: string; role: Role } | null {
  try {
    const decoded = jwt.verify(token, jwtSecret) as TwoFATempPayload;
    if (decoded.type !== "2fa_pending") return null;
    return { userId: decoded.sub, role: decoded.role };
  } catch {
    return null;
  }
}

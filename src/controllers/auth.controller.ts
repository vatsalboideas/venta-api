import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { Request, Response, NextFunction } from "express";
import qrcode from "qrcode";
import speakeasy from "speakeasy";

import { prisma } from "../prisma";
import {
  signAccessToken,
  signTwoFATempToken,
  verifyTwoFATempToken,
} from "../utils/jwt";
import {
  requireEmail,
  requireMinLength,
  requireString,
  ValidationError,
} from "../utils/validate";

const ALLOWED_SELF_ROLES: Role[] = [Role.EMPLOYEE, Role.INTERN];
const MANAGEABLE_ROLES: Role[] = [Role.EMPLOYEE, Role.INTERN];

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : undefined;
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const name = requireString("name", req.body.name);
    const email = requireEmail("email", req.body.email);
    const rawPassword = requireString("password", req.body.password);
    requireMinLength("password", rawPassword, 8);

    const { phone, position, department } = req.body as {
      phone?: string;
      position?: string;
      department?: string;
    };

    // Public registration cannot self-assign BOSS role
    const requestedRole = req.body.role as Role | undefined;
    if (requestedRole !== undefined && !ALLOWED_SELF_ROLES.includes(requestedRole)) {
      throw new ValidationError("role must be one of: EMPLOYEE, INTERN");
    }
    const role = requestedRole ?? Role.EMPLOYEE;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ message: "Email already exists" });

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const user = await prisma.user.create({
      data: { name, email, phone, password: passwordHash, position, department, role },
    });

    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    return next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const email = requireString("email", req.body.email);
    const password = requireString("password", req.body.password);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return res.status(401).json({ message: "Invalid credentials" });

    const requiresTwoFactor = user.twoFAEnabled && Boolean(user.twoFASecret);
    if (requiresTwoFactor) {
      const tempToken = signTwoFATempToken({ id: user.id, role: user.role });
      return res.json({ requiresTwoFactor: true, tempToken });
    }

    const accessToken = signAccessToken({ id: user.id, role: user.role });
    return res.json({
      requiresTwoFactor: false,
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        department: true,
        position: true,
        twoFAEnabled: true,
        twoFASecret: true,
      },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    const effectiveTwoFAEnabled = Boolean(user.twoFAEnabled && user.twoFASecret);
    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      department: user.department,
      position: user.position,
      twoFAEnabled: effectiveTwoFAEnabled,
    });
  } catch (err) {
    return next(err);
  }
}

export async function setupGoogleAuthenticator(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.twoFAEnabled) {
      return res.status(409).json({ message: "2FA is already enabled. Disable it first to re-setup." });
    }

    const secret = speakeasy.generateSecret({
      length: 20,
      name: `${process.env.TOTP_APP_NAME ?? "Venta ERP"} (${user.email})`,
      issuer: process.env.TOTP_APP_NAME ?? "Venta ERP",
    });
    const otpauth = secret.otpauth_url ?? "";
    const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFASecret: secret.base32, twoFAEnabled: false },
    });

    return res.json({
      message: "Scan QR and verify token to enable 2FA",
      otpauthUrl: otpauth,
      qrCodeDataUrl,
    });
  } catch (err) {
    return next(err);
  }
}

export async function verifyGoogleAuthenticatorSetup(req: Request, res: Response, next: NextFunction) {
  try {
    const token = requireString("token", req.body.token);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.twoFASecret) {
      return res.status(400).json({ message: "2FA setup not initialized" });
    }
    if (user.twoFAEnabled) {
      return res.status(409).json({ message: "2FA is already enabled" });
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: "base32",
      token,
      window: 1,
    });
    if (!isValid) return res.status(400).json({ message: "Invalid authenticator code" });

    await prisma.user.update({ where: { id: user.id }, data: { twoFAEnabled: true } });
    return res.json({ message: "2FA enabled successfully" });
  } catch (err) {
    return next(err);
  }
}

export async function verifyGoogleAuthenticatorLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const tempToken = requireString("tempToken", req.body.tempToken);
    const token = requireString("token", req.body.token);

    const payload = verifyTwoFATempToken(tempToken);
    if (!payload) return res.status(401).json({ message: "Invalid or expired temp token" });

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user?.twoFASecret || !user.twoFAEnabled) {
      return res.status(400).json({ message: "2FA is not enabled for this user" });
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: "base32",
      token,
      window: 1,
    });
    if (!isValid) return res.status(400).json({ message: "Invalid authenticator code" });

    const accessToken = signAccessToken({ id: user.id, role: user.role });
    return res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return next(err);
  }
}

export async function disableGoogleAuthenticator(req: Request, res: Response, next: NextFunction) {
  try {
    const token = requireString("token", req.body.token);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.twoFASecret || !user.twoFAEnabled) {
      return res.status(400).json({ message: "2FA is not enabled" });
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: "base32",
      token,
      window: 1,
    });
    if (!isValid) return res.status(400).json({ message: "Invalid authenticator code" });

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFAEnabled: false, twoFASecret: null },
    });
    return res.json({ message: "2FA disabled successfully" });
  } catch (err) {
    return next(err);
  }
}

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const createdByMe = req.query.createdByMe === "1" || req.query.createdByMe === "true";
    const users = await prisma.user.findMany({
      where: createdByMe ? { createdBy: req.user!.id } : { role: { in: MANAGEABLE_ROLES } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        department: true,
        position: true,
        createdBy: true,
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(users);
  } catch (err) {
    return next(err);
  }
}

export async function createIntern(req: Request, res: Response, next: NextFunction) {
  try {
    const name = requireString("name", req.body.name);
    const email = requireEmail("email", req.body.email);
    const rawPassword = requireString("password", req.body.password);
    requireMinLength("password", rawPassword, 8);

    const phone = optionalString(req.body.phone);
    const position = optionalString(req.body.position);
    const department = optionalString(req.body.department);

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ message: "Email already exists" });

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: passwordHash,
        position,
        department,
        role: Role.INTERN,
        createdBy: req.user!.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        department: true,
        position: true,
        createdBy: true,
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return res.status(201).json(user);
  } catch (err) {
    return next(err);
  }
}

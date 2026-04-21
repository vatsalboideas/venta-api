import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { Request, Response, NextFunction } from "express";
import qrcode from "qrcode";
import speakeasy from "speakeasy";

import { prisma } from "../prisma";
import { isConcurrentWriteConflict, lockRowOrThrow } from "../utils/concurrency";
import {
  signAccessToken,
  signTwoFATempToken,
  verifyTwoFATempToken,
} from "../utils/jwt";
import {
  requireEmail,
  optionalEnum,
  requireMinLength,
  requireString,
  ValidationError,
} from "../utils/validate";

const ALLOWED_SELF_ROLES: Role[] = [Role.EMPLOYEE, Role.INTERN];
const MANAGEABLE_ROLES: Role[] = [Role.MANAGER, Role.EMPLOYEE, Role.INTERN];
const DELEGATABLE_ROLES: Role[] = [Role.EMPLOYEE, Role.INTERN];

function assertBoss(role: Role) {
  if (role !== Role.BOSS) {
    const err = new Error("Forbidden");
    // @ts-expect-error custom status for controller handling
    err.status = 403;
    throw err;
  }
}

type ScopedActor = { id: string; role: Role };

function canCreateRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === Role.BOSS) return MANAGEABLE_ROLES.includes(targetRole);
  if (actorRole === Role.MANAGER) return targetRole === Role.EMPLOYEE || targetRole === Role.INTERN;
  if (actorRole === Role.EMPLOYEE) return targetRole === Role.INTERN;
  return false;
}

function canEditRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === Role.BOSS) return MANAGEABLE_ROLES.includes(targetRole);
  if (actorRole === Role.MANAGER) return targetRole === Role.EMPLOYEE || targetRole === Role.INTERN;
  if (actorRole === Role.EMPLOYEE) return targetRole === Role.INTERN;
  return false;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : undefined;
}

function optionalNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

async function ensureDepartmentExistsOrThrow(department: string | null | undefined) {
  if (!department) return;
  const found = await prisma.department.findFirst({
    where: { name: { equals: department, mode: "insensitive" } },
    select: { id: true },
  });
  if (!found) {
    throw new ValidationError("department must be an existing department");
  }
}

async function ensureEmployeeTypeExistsOrThrow(role: Role | undefined) {
  if (!role) return;
  const found = await prisma.employeeType.findFirst({ where: { code: role }, select: { id: true } });
  if (!found) {
    throw new ValidationError("role must be an existing employee type");
  }
}

type ManagedUserNode = {
  id: string;
  role: Role;
  createdBy: string | null;
};

function isDescendantOf(
  descendantId: string,
  ancestorId: string,
  usersById: Map<string, ManagedUserNode>,
): boolean {
  const visited = new Set<string>();
  let cursorId = usersById.get(descendantId)?.createdBy ?? null;
  while (cursorId) {
    if (visited.has(cursorId)) break;
    if (cursorId === ancestorId) return true;
    visited.add(cursorId);
    cursorId = usersById.get(cursorId)?.createdBy ?? null;
  }
  return false;
}

function canManageUserNode(actor: ScopedActor, target: ManagedUserNode, usersById: Map<string, ManagedUserNode>): boolean {
  if (actor.role === Role.BOSS) return MANAGEABLE_ROLES.includes(target.role);
  if (actor.role !== Role.MANAGER && actor.role !== Role.EMPLOYEE) return false;
  if (!canEditRole(actor.role, target.role)) return false;
  return isDescendantOf(target.id, actor.id, usersById);
}

function findNearestAncestorByRole(
  user: ManagedUserNode,
  usersById: Map<string, ManagedUserNode>,
  allowedRoles: Role[],
): ManagedUserNode | null {
  const visited = new Set<string>();
  let cursorId = user.createdBy;
  while (cursorId) {
    if (visited.has(cursorId)) break;
    visited.add(cursorId);
    const parent = usersById.get(cursorId);
    if (!parent) break;
    if (allowedRoles.includes(parent.role)) return parent;
    cursorId = parent.createdBy;
  }
  return null;
}

function getManagerAnchorId(user: ManagedUserNode, usersById: Map<string, ManagedUserNode>): string | null {
  if (user.role === Role.MANAGER) return user.id;
  return findNearestAncestorByRole(user, usersById, [Role.MANAGER])?.id ?? null;
}

function buildAutoTransferTarget(
  user: ManagedUserNode,
  usersById: Map<string, ManagedUserNode>,
): ManagedUserNode | null {
  if (user.role === Role.INTERN) {
    return findNearestAncestorByRole(user, usersById, [Role.EMPLOYEE, Role.MANAGER]);
  }
  if (user.role === Role.EMPLOYEE) {
    return findNearestAncestorByRole(user, usersById, [Role.MANAGER]);
  }
  return null;
}

function isAllowedManualTransfer(
  source: ManagedUserNode,
  target: ManagedUserNode,
  usersById: Map<string, ManagedUserNode>,
): boolean {
  if (source.id === target.id) return false;
  if (source.role === Role.MANAGER) return target.role === Role.MANAGER;
  if (!DELEGATABLE_ROLES.includes(target.role)) return false;

  const sourceManagerId = getManagerAnchorId(source, usersById);
  const targetManagerId = getManagerAnchorId(target, usersById);
  return Boolean(sourceManagerId && targetManagerId && sourceManagerId === targetManagerId);
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
    await ensureEmployeeTypeExistsOrThrow(role);
    await ensureDepartmentExistsOrThrow(optionalString(department));

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
    const effectiveTwoFAEnabled = Boolean(user.twoFAEnabled);
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

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, role: true },
    });
    if (!actor) return res.status(404).json({ message: "User not found" });

    const name = req.body.name === undefined ? undefined : requireString("name", req.body.name);
    const email = req.body.email === undefined ? undefined : requireEmail("email", req.body.email);
    const phone = optionalNullableString(req.body.phone);
    const position = optionalNullableString(req.body.position);
    const department = optionalNullableString(req.body.department);

    const isBossOrManager = actor.role === Role.BOSS || actor.role === Role.MANAGER;
    if (!isBossOrManager) {
      const hasRestrictedField =
        req.body.email !== undefined ||
        req.body.phone !== undefined ||
        req.body.position !== undefined ||
        req.body.department !== undefined;
      if (hasRestrictedField) {
        return res.status(403).json({
          message: "Employees and interns can only update their name",
        });
      }
    }

    if (isBossOrManager) {
      await ensureDepartmentExistsOrThrow(department);
    }

    const data = {
      ...(name !== undefined ? { name } : {}),
      ...(isBossOrManager && email !== undefined ? { email } : {}),
      ...(isBossOrManager && phone !== undefined ? { phone } : {}),
      ...(isBossOrManager && position !== undefined ? { position } : {}),
      ...(isBossOrManager && department !== undefined ? { department } : {}),
    };

    if (Object.keys(data).length === 0) {
      throw new ValidationError("At least one editable field is required");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await lockRowOrThrow(tx, "users", actor.id, "User not found");
      return tx.user.update({
        where: { id: actor.id },
        data,
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
    });

    return res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      department: updated.department,
      position: updated.position,
      twoFAEnabled: Boolean(updated.twoFAEnabled),
    });
  } catch (err) {
    if (isConcurrentWriteConflict(err)) {
      return res.status(409).json({ message: "Your profile is being modified by another action. Please retry." });
    }
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
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const rawPage = typeof req.query.page === "string" ? Number(req.query.page) : NaN;
    const rawLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : NaN;
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : undefined;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : undefined;

    const where = {
      role: { in: MANAGEABLE_ROLES },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { department: { contains: q, mode: "insensitive" as const } },
              { position: { contains: q, mode: "insensitive" as const } },
              { creator: { name: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const users = await prisma.user.findMany({
      where,
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
      skip: page && limit ? (page - 1) * limit : undefined,
      take: limit,
    });
    return res.json(users);
  } catch (err) {
    return next(err);
  }
}

export async function createIntern(req: Request, res: Response, next: NextFunction) {
  try {
    const actor: ScopedActor = { id: req.user!.id, role: req.user!.role };
    const name = requireString("name", req.body.name);
    const email = requireEmail("email", req.body.email);
    const rawPassword = requireString("password", req.body.password);
    requireMinLength("password", rawPassword, 8);

    const phone = optionalString(req.body.phone);
    const position = optionalString(req.body.position);
    const department = optionalString(req.body.department);
    const role = optionalEnum("role", req.body.role, MANAGEABLE_ROLES) ?? Role.INTERN;
    if (!canCreateRole(actor.role, role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await ensureDepartmentExistsOrThrow(department);
    await ensureEmployeeTypeExistsOrThrow(role);

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
        role,
        createdBy: actor.id,
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

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const actor: ScopedActor = { id: req.user!.id, role: req.user!.role };
    const id = requireString("id", req.params.id);
    const nextRole = optionalEnum("role", req.body.role, MANAGEABLE_ROLES);
    const email = req.body.email === undefined ? undefined : requireEmail("email", req.body.email);
    const name = req.body.name === undefined ? undefined : requireString("name", req.body.name);
    const phone = optionalNullableString(req.body.phone);
    const position = optionalNullableString(req.body.position);
    const department = optionalNullableString(req.body.department);
    await ensureDepartmentExistsOrThrow(department);
    await ensureEmployeeTypeExistsOrThrow(nextRole);

    const data = {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(position !== undefined ? { position } : {}),
      ...(department !== undefined ? { department } : {}),
      ...(nextRole !== undefined ? { role: nextRole } : {}),
    };

    if (Object.keys(data).length === 0) {
      throw new ValidationError("At least one editable field is required");
    }

    const allManagedUsers = await prisma.user.findMany({
      where: { role: { in: MANAGEABLE_ROLES } },
      select: { id: true, role: true, createdBy: true },
    });
    const usersById = new Map<string, ManagedUserNode>(allManagedUsers.map((user) => [user.id, user]));
    const target = usersById.get(id);
    if (!target) return res.status(404).json({ message: "Employee not found" });
    if (!canManageUserNode(actor, target, usersById)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (nextRole !== undefined && !canCreateRole(actor.role, nextRole)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await lockRowOrThrow(tx, "users", id, "Employee not found");
      return tx.user.update({
        where: { id },
        data,
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
      });
    });
    return res.json(updated);
  } catch (err) {
    if (isConcurrentWriteConflict(err)) {
      return res.status(409).json({ message: "Employee is being modified by another user. Please retry." });
    }
    return next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const actor: ScopedActor = { id: req.user!.id, role: req.user!.role };
    const id = requireString("id", req.params.id);
    const transferToUserId = optionalString(req.query.transferToUserId ?? req.body?.transferToUserId);

    const allManagedUsers = await prisma.user.findMany({
      where: { role: { in: MANAGEABLE_ROLES } },
      select: { id: true, role: true, createdBy: true },
    });
    const usersById = new Map<string, ManagedUserNode>(allManagedUsers.map((user) => [user.id, user]));
    const sourceNode = usersById.get(id);
    if (!sourceNode) {
      return res.status(404).json({ message: "Employee not found" });
    }
    if (!canManageUserNode(actor, sourceNode, usersById)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    let transferTarget: ManagedUserNode | null = null;
    if (transferToUserId) {
      const manualTarget = usersById.get(transferToUserId);
      if (!manualTarget) {
        return res.status(400).json({ message: "Selected transfer user not found" });
      }
      if (!canManageUserNode(actor, manualTarget, usersById)) {
        return res.status(400).json({ message: "Selected transfer user is outside your hierarchy scope" });
      }
      if (!isAllowedManualTransfer(sourceNode, manualTarget, usersById)) {
        return res.status(400).json({ message: "Selected transfer user is outside allowed hierarchy" });
      }
      transferTarget = manualTarget;
    } else if (sourceNode.role === Role.MANAGER && actor.role === Role.BOSS) {
      return res.status(400).json({ message: "Manager deletion requires selecting another manager" });
    } else {
      transferTarget = buildAutoTransferTarget(sourceNode, usersById);
    }

    if (!transferTarget) {
      return res.status(409).json({ message: "No valid transfer target found for this employee" });
    }

    await prisma.$transaction(async (tx) => {
      await lockRowOrThrow(tx, "users", id, "Employee not found");
      await tx.brand.updateMany({ where: { ownerId: id }, data: { ownerId: transferTarget.id } });
      await tx.contact.updateMany({ where: { createdBy: id }, data: { createdBy: transferTarget.id } });
      await tx.log.updateMany({ where: { assignedTo: id }, data: { assignedTo: transferTarget.id } });
      await tx.logRevision.updateMany({ where: { changedBy: id }, data: { changedBy: transferTarget.id } });
      await tx.logRevision.updateMany({ where: { assignedTo: id }, data: { assignedTo: transferTarget.id } });
      await tx.user.updateMany({ where: { createdBy: id }, data: { createdBy: transferTarget.id } });
      await tx.user.delete({ where: { id } });
    });

    return res.json({
      message: "Employee deleted and related data transferred",
      transferredTo: transferTarget.id,
    });
  } catch (err) {
    if (isConcurrentWriteConflict(err)) {
      return res.status(409).json({ message: "Employee is being modified by another user. Please retry." });
    }
    return next(err);
  }
}

import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";

import { prisma } from "../prisma";
import { AuthUser } from "../types/auth";

type RequestWithUser = Request & { user?: AuthUser };

export function requireAuth(req: RequestWithUser, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
}

export function canManageBrand(user: AuthUser, ownerId: string): boolean {
  if (user.role === Role.BOSS) return true;
  return user.id === ownerId;
}

export function canManageLog(user: AuthUser, assignedTo: string): boolean {
  if (user.role === Role.BOSS) return true;
  return user.id === assignedTo;
}

export async function assertBrandWriteAccessOrThrow(user: AuthUser, brandId: string) {
  if (user.role === Role.BOSS) return;

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { ownerId: true },
  });

  if (!brand) {
    const err = new Error("Brand not found");
    // @ts-expect-error custom status for controller handling
    err.status = 404;
    throw err;
  }

  if (brand.ownerId !== user.id) {
    const err = new Error("Forbidden");
    // @ts-expect-error custom status for controller handling
    err.status = 403;
    throw err;
  }
}

export async function assertContactWriteAccessOrThrow(user: AuthUser, contactId: string) {
  if (user.role === Role.BOSS) return;

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { createdBy: true },
  });

  if (!contact) {
    const err = new Error("Contact not found");
    // @ts-expect-error custom status for controller handling
    err.status = 404;
    throw err;
  }

  if (contact.createdBy !== user.id) {
    const err = new Error("Forbidden");
    // @ts-expect-error custom status for controller handling
    err.status = 403;
    throw err;
  }
}

export async function assertLogWriteAccessOrThrow(user: AuthUser, logId: string) {
  if (user.role === Role.BOSS) return;

  const log = await prisma.log.findUnique({
    where: { id: logId },
    select: { assignedTo: true },
  });

  if (!log) {
    const err = new Error("Log not found");
    // @ts-expect-error custom status for controller handling
    err.status = 404;
    throw err;
  }

  if (log.assignedTo !== user.id) {
    const err = new Error("Forbidden");
    // @ts-expect-error custom status for controller handling
    err.status = 403;
    throw err;
  }
}

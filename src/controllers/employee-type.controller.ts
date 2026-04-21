import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";

import { prisma } from "../prisma";
import { isConcurrentWriteConflict, lockRowOrThrow } from "../utils/concurrency";
import { requireString, ValidationError } from "../utils/validate";

const ALLOWED_CODES: Role[] = [Role.BOSS, Role.MANAGER, Role.EMPLOYEE, Role.INTERN];
const ROLE_ORDER: Record<Role, number> = {
  [Role.BOSS]: 0,
  [Role.MANAGER]: 1,
  [Role.EMPLOYEE]: 2,
  [Role.INTERN]: 3,
};

function assertBoss(role: Role) {
  if (role !== Role.BOSS) {
    const err = new Error("Forbidden");
    // @ts-expect-error custom status for controller handling
    err.status = 403;
    throw err;
  }
}

export async function listEmployeeTypes(req: Request, res: Response, next: NextFunction) {
  try {
    assertBoss(req.user!.role);
    const rows = await prisma.employeeType.findMany({
      where: { code: { in: ALLOWED_CODES } },
      select: { id: true, code: true, label: true, createdAt: true, updatedAt: true },
    });
    rows.sort((a, b) => ROLE_ORDER[a.code] - ROLE_ORDER[b.code]);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

export async function updateEmployeeType(req: Request, res: Response, next: NextFunction) {
  try {
    assertBoss(req.user!.role);
    const id = requireString("id", req.params.id);
    const label = requireString("label", req.body.label);
    const existing = await prisma.employeeType.findFirst({ where: { id }, select: { id: true } });
    if (!existing) return res.status(404).json({ message: "Employee type not found" });

    const updated = await prisma.$transaction(async (tx) => {
      await lockRowOrThrow(tx, "employee_types", id, "Employee type not found");
      return tx.employeeType.update({
        where: { id },
        data: { label },
        select: { id: true, code: true, label: true, createdAt: true, updatedAt: true },
      });
    });
    return res.json(updated);
  } catch (err) {
    if (isConcurrentWriteConflict(err)) {
      return res.status(409).json({ message: "Employee type is being modified by another user. Please retry." });
    }
    return next(err);
  }
}

export async function createEmployeeType(req: Request, res: Response, next: NextFunction) {
  try {
    assertBoss(req.user!.role);
    const codeRaw = requireString("code", req.body.code).toUpperCase();
    const label = requireString("label", req.body.label);
    if (!ALLOWED_CODES.includes(codeRaw as Role)) {
      throw new ValidationError("code must be one of: BOSS, MANAGER, EMPLOYEE, INTERN");
    }
    const code = codeRaw as Role;

    const exists = await prisma.employeeType.findFirst({ where: { code }, select: { id: true } });
    if (exists) return res.status(409).json({ message: "Employee type already exists" });

    const created = await prisma.employeeType.create({
      data: { code, label },
      select: { id: true, code: true, label: true, createdAt: true, updatedAt: true },
    });
    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
}

export async function deleteEmployeeType(req: Request, res: Response, next: NextFunction) {
  try {
    assertBoss(req.user!.role);
    const id = requireString("id", req.params.id);
    const type = await prisma.employeeType.findFirst({ where: { id }, select: { id: true, code: true } });
    if (!type) return res.status(404).json({ message: "Employee type not found" });

    const usersUsingType = await prisma.user.count({ where: { role: type.code } });
    if (usersUsingType > 0) {
      return res.status(409).json({ message: "Cannot delete employee type that is assigned to users" });
    }

    await prisma.$transaction(async (tx) => {
      await lockRowOrThrow(tx, "employee_types", id, "Employee type not found");
      await tx.employeeType.delete({ where: { id } });
    });
    return res.status(204).send();
  } catch (err) {
    if (isConcurrentWriteConflict(err)) {
      return res.status(409).json({ message: "Employee type is being modified by another user. Please retry." });
    }
    return next(err);
  }
}


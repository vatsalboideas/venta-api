import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";

import { prisma } from "../prisma";
import { isConcurrentWriteConflict, lockRowOrThrow } from "../utils/concurrency";
import { requireString } from "../utils/validate";

function assertBoss(role: Role) {
  if (role !== Role.BOSS) {
    const err = new Error("Forbidden");
    // @ts-expect-error custom status for controller handling
    err.status = 403;
    throw err;
  }
}

export async function listDepartments(req: Request, res: Response, next: NextFunction) {
  try {
    assertBoss(req.user!.role);
    const rows = await prisma.department.findMany({
      select: { id: true, name: true, createdAt: true, updatedAt: true },
      orderBy: { name: "asc" },
    });
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

export async function createDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    assertBoss(req.user!.role);
    const name = requireString("name", req.body.name);
    const created = await prisma.department.create({
      data: { name },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });
    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
}

export async function updateDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    assertBoss(req.user!.role);
    const id = requireString("id", req.params.id);
    const name = requireString("name", req.body.name);
    const existing = await prisma.department.findFirst({ where: { id }, select: { id: true } });
    if (!existing) return res.status(404).json({ message: "Department not found" });

    const updated = await prisma.$transaction(async (tx) => {
      await lockRowOrThrow(tx, "departments", id, "Department not found");
      return tx.department.update({
        where: { id },
        data: { name },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      });
    });
    return res.json(updated);
  } catch (err) {
    if (isConcurrentWriteConflict(err)) {
      return res.status(409).json({ message: "Department is being modified by another user. Please retry." });
    }
    return next(err);
  }
}

export async function deleteDepartment(req: Request, res: Response, next: NextFunction) {
  try {
    assertBoss(req.user!.role);
    const id = requireString("id", req.params.id);
    const existing = await prisma.department.findFirst({ where: { id }, select: { id: true, name: true } });
    if (!existing) return res.status(404).json({ message: "Department not found" });

    const usersUsingDepartment = await prisma.user.count({ where: { department: existing.name } });
    if (usersUsingDepartment > 0) {
      return res.status(409).json({ message: "Cannot delete department that is assigned to employees" });
    }

    await prisma.$transaction(async (tx) => {
      await lockRowOrThrow(tx, "departments", id, "Department not found");
      await tx.department.delete({ where: { id } });
    });
    return res.status(204).send();
  } catch (err) {
    if (isConcurrentWriteConflict(err)) {
      return res.status(409).json({ message: "Department is being modified by another user. Please retry." });
    }
    return next(err);
  }
}

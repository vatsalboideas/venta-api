import { LogStatus, Priority } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { Request, Response, NextFunction } from "express";

import { assertLogWriteAccessOrThrow } from "../middleware/authz";
import { prisma, syncBrandForecastOnClosedWon } from "../prisma";
import {
  requireDate,
  requireEnum,
  requireNonNegativeNumber,
  requireString,
} from "../utils/validate";

type LogIdParams = { id: string };

const LOG_STATUSES = Object.values(LogStatus) as LogStatus[];
const PRIORITIES = Object.values(Priority) as Priority[];

function withExpectedRevenue<T extends { brand: { expectedRevenue: unknown } }>(log: T) {
  return { ...log, expectedRevenue: Number(log.brand.expectedRevenue) };
}

export async function listLogs(_req: Request, res: Response, next: NextFunction) {
  try {
    const logs = await prisma.log.findMany({
      include: {
        brand: { select: { id: true, name: true, expectedRevenue: true } },
        contact: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(logs.map(withExpectedRevenue));
  } catch (err) {
    return next(err);
  }
}

export async function getLog(req: Request<LogIdParams>, res: Response, next: NextFunction) {
  try {
    const log = await prisma.log.findUnique({
      where: { id: req.params.id },
      include: {
        brand: { select: { id: true, name: true, expectedRevenue: true } },
        contact: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    if (!log) return res.status(404).json({ message: "Log not found" });
    return res.json(withExpectedRevenue(log));
  } catch (err) {
    return next(err);
  }
}

export async function createLog(req: Request, res: Response, next: NextFunction) {
  try {
    const title = requireString("title", req.body.title);
    const brandId = requireString("brandId", req.body.brandId);
    const contactId = requireString("contactId", req.body.contactId);
    const status = requireEnum("status", req.body.status, LOG_STATUSES);
    const priority = requireEnum("priority", req.body.priority, PRIORITIES);
    const assignedTo = requireString("assignedTo", req.body.assignedTo);
    const notes = requireString("notes", req.body.notes);
    const lastContactDate = requireDate("lastContactDate", req.body.lastContactDate);
    const followUpDate = requireDate("followUpDate", req.body.followUpDate);
    const meetingDate = requireDate("meetingDate", req.body.meetingDate);
    const actualRevenue = requireNonNegativeNumber("actualRevenue", req.body.actualRevenue);

    // Verify brand exists
    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true, ownerId: true } });
    if (!brand) return res.status(404).json({ message: "Brand not found" });

    // Contact must belong to selected brand.
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, brandId },
      select: { id: true },
    });
    if (!contact) return res.status(404).json({ message: "Contact not found for selected brand" });

    // Assignee must match selected brand owner.
    if (assignedTo !== brand.ownerId) {
      return res.status(400).json({ message: "assignedTo must be the selected brand owner" });
    }

    const created = await prisma.log.create({
      data: {
        title,
        brandId,
        contactId,
        status,
        priority,
        assignedTo,
        lastContactDate,
        followUpDate,
        meetingDate,
        actualRevenue,
        notes,
      },
      include: {
        brand: { select: { id: true, name: true, expectedRevenue: true } },
        contact: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    await syncBrandForecastOnClosedWon({ status: created.status, brandId: created.brandId });
    return res.status(201).json(withExpectedRevenue(created));
  } catch (err) {
    return next(err);
  }
}

export async function updateLog(req: Request<LogIdParams>, res: Response, next: NextFunction) {
  try {
    await assertLogWriteAccessOrThrow(req.user!, req.params.id);

    const title = requireString("title", req.body.title);
    const brandId = requireString("brandId", req.body.brandId);
    const contactId = requireString("contactId", req.body.contactId);
    const status = requireEnum("status", req.body.status, LOG_STATUSES);
    const priority = requireEnum("priority", req.body.priority, PRIORITIES);
    const assignedTo = requireString("assignedTo", req.body.assignedTo);
    const notes = requireString("notes", req.body.notes);
    const lastContactDate = requireDate("lastContactDate", req.body.lastContactDate);
    const followUpDate = requireDate("followUpDate", req.body.followUpDate);
    const meetingDate = requireDate("meetingDate", req.body.meetingDate);
    const actualRevenue = requireNonNegativeNumber("actualRevenue", req.body.actualRevenue);

    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true, ownerId: true } });
    if (!brand) return res.status(404).json({ message: "Brand not found" });

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, brandId },
      select: { id: true },
    });
    if (!contact) return res.status(404).json({ message: "Contact not found for selected brand" });

    if (assignedTo !== brand.ownerId) {
      return res.status(400).json({ message: "assignedTo must be the selected brand owner" });
    }

    const updated = await prisma.log.update({
      where: { id: req.params.id },
      data: {
        title,
        brandId,
        contactId,
        status,
        priority,
        assignedTo,
        lastContactDate,
        followUpDate,
        meetingDate,
        actualRevenue,
        notes,
      },
      include: {
        brand: { select: { id: true, name: true, expectedRevenue: true } },
        contact: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    await syncBrandForecastOnClosedWon({ status: updated.status, brandId: updated.brandId });
    return res.json(withExpectedRevenue(updated));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ message: "Log not found" });
    }
    return next(err);
  }
}

export async function deleteLog(req: Request<LogIdParams>, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    await assertLogWriteAccessOrThrow(user, req.params.id);
    await prisma.log.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ message: "Log not found" });
    }
    return next(err);
  }
}

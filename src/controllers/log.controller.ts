import { LogStatus, Priority, Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { Request, Response, NextFunction } from "express";

import { assertLogWriteAccessOrThrow } from "../middleware/authz";
import { prisma, syncBrandForecastOnClosedWon } from "../prisma";
import {
  optionalEnum,
  parseOptionalDate,
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
    const user = req.user!;
    const title = requireString("title", req.body.title);
    const brandId = requireString("brandId", req.body.brandId);
    const status = requireEnum("status", req.body.status, LOG_STATUSES);
    const priority = requireEnum("priority", req.body.priority, PRIORITIES);

    // Verify brand exists
    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } });
    if (!brand) return res.status(404).json({ message: "Brand not found" });

    const { contactId, assignedTo: rawAssignedTo, notes } = req.body as Record<string, unknown>;

    // Verify optional contact
    if (contactId) {
      const contact = await prisma.contact.findUnique({ where: { id: contactId as string }, select: { id: true } });
      if (!contact) return res.status(404).json({ message: "Contact not found" });
    }

    // Determine assignee
    let assignedTo = user.id;
    if (user.role === Role.BOSS && rawAssignedTo) {
      const assignee = await prisma.user.findUnique({ where: { id: rawAssignedTo as string }, select: { id: true } });
      if (!assignee) return res.status(404).json({ message: "Assigned user not found" });
      assignedTo = rawAssignedTo as string;
    }

    // Validate optional fields
    const lastContactDate = parseOptionalDate("lastContactDate", req.body.lastContactDate);
    const followUpDate = parseOptionalDate("followUpDate", req.body.followUpDate);
    const meetingDate = parseOptionalDate("meetingDate", req.body.meetingDate);
    const actualRevenue =
      req.body.actualRevenue !== undefined && req.body.actualRevenue !== null
        ? requireNonNegativeNumber("actualRevenue", req.body.actualRevenue)
        : null;

    const created = await prisma.log.create({
      data: {
        title,
        brandId,
        contactId: (contactId as string | undefined) ?? null,
        status,
        priority,
        assignedTo,
        lastContactDate,
        followUpDate,
        meetingDate,
        actualRevenue,
        notes: (notes as string | undefined) ?? null,
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
    const user = req.user!;
    await assertLogWriteAccessOrThrow(user, req.params.id);

    const status = optionalEnum("status", req.body.status, LOG_STATUSES);
    const priority = optionalEnum("priority", req.body.priority, PRIORITIES);

    const {
      title,
      brandId,
      contactId,
      assignedTo: rawAssignedTo,
      notes,
    } = req.body as Record<string, unknown>;

    // Verify new brandId if being changed
    if (brandId !== undefined) {
      const brand = await prisma.brand.findUnique({ where: { id: brandId as string }, select: { id: true } });
      if (!brand) return res.status(404).json({ message: "Brand not found" });
    }

    // Verify new contactId if being changed
    if (contactId !== undefined && contactId !== null) {
      const contact = await prisma.contact.findUnique({ where: { id: contactId as string }, select: { id: true } });
      if (!contact) return res.status(404).json({ message: "Contact not found" });
    }

    // Validate optional fields
    const lastContactDate =
      "lastContactDate" in req.body ? parseOptionalDate("lastContactDate", req.body.lastContactDate) : undefined;
    const followUpDate =
      "followUpDate" in req.body ? parseOptionalDate("followUpDate", req.body.followUpDate) : undefined;
    const meetingDate =
      "meetingDate" in req.body ? parseOptionalDate("meetingDate", req.body.meetingDate) : undefined;
    const actualRevenue =
      "actualRevenue" in req.body
        ? req.body.actualRevenue !== null
          ? requireNonNegativeNumber("actualRevenue", req.body.actualRevenue)
          : null
        : undefined;

    let resolvedAssignedTo: string | undefined;
    if (user.role === Role.BOSS && rawAssignedTo !== undefined) {
      const assignee = await prisma.user.findUnique({ where: { id: rawAssignedTo as string }, select: { id: true } });
      if (!assignee) return res.status(404).json({ message: "Assigned user not found" });
      resolvedAssignedTo = rawAssignedTo as string;
    }

    const updated = await prisma.log.update({
      where: { id: req.params.id },
      data: {
        title: title as string | undefined,
        brandId: brandId as string | undefined,
        contactId: contactId === undefined ? undefined : ((contactId as string | null) ?? null),
        status,
        priority,
        assignedTo: resolvedAssignedTo,
        lastContactDate,
        followUpDate,
        meetingDate,
        actualRevenue,
        notes: notes === undefined ? undefined : ((notes as string) ?? null),
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

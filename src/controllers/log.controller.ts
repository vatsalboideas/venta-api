import { LogRevisionType, LogStatus, Priority } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { Request, Response, NextFunction } from "express";

import { assertLogWriteAccessOrThrow } from "../middleware/authz";
import { prisma, syncBrandForecastOnClosedWon } from "../prisma";
import { isConcurrentWriteConflict, lockRowOrThrow } from "../utils/concurrency";
import {
  requireDate,
  requireEnum,
  optionalNonNegativeNumber,
  requireString,
} from "../utils/validate";

type LogIdParams = { id: string };

const LOG_STATUSES = Object.values(LogStatus) as LogStatus[];
const PRIORITIES = Object.values(Priority) as Priority[];
const DATE_FIELDS = ["createdAt", "lastContactDate", "followUpDate", "meetingDate", "all"] as const;
type DateField = (typeof DATE_FIELDS)[number];

function withExpectedRevenue<T extends { brand: { expectedRevenue: unknown } }>(log: T) {
  return { ...log, expectedRevenue: Number(log.brand.expectedRevenue) };
}

function withRevisionRevenue<T extends { actualRevenue: unknown }>(revision: T) {
  return {
    ...revision,
    actualRevenue:
      revision.actualRevenue === null || revision.actualRevenue === undefined
        ? null
        : Number(revision.actualRevenue),
  };
}

async function createLogRevision(args: {
  logId: string;
  revisionType: LogRevisionType;
  changedBy: string;
  values: {
    title: string;
    brandId: string;
    contactId: string;
    status: LogStatus;
    priority: Priority;
    assignedTo: string;
    lastContactDate: Date;
    followUpDate: Date;
    meetingDate: Date;
    actualRevenue: number | null;
    notes: string;
  };
}) {
  return prisma.logRevision.create({
    data: {
      logId: args.logId,
      revisionType: args.revisionType,
      changedBy: args.changedBy,
      ...args.values,
    },
  });
}

export async function listLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const brandId = typeof req.query.brandId === "string" ? req.query.brandId.trim() : "";
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const fromDate = typeof req.query.fromDate === "string" ? req.query.fromDate.trim() : "";
    const toDate = typeof req.query.toDate === "string" ? req.query.toDate.trim() : "";
    const requestedDateField =
      typeof req.query.dateField === "string" ? req.query.dateField.trim() : "";
    const dateField: DateField = DATE_FIELDS.includes(requestedDateField as DateField)
      ? (requestedDateField as DateField)
      : "createdAt";
    const sort = req.query.sort === "oldest" ? "asc" : "desc";
    const pageRaw = typeof req.query.page === "string" ? Number(req.query.page) : undefined;
    const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const page = pageRaw && Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : undefined;
    const limit = limitRaw && Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : undefined;

    const dateRangeFilter: Prisma.DateTimeFilter = {};
    if (fromDate) {
      const from = new Date(fromDate);
      if (!Number.isNaN(from.getTime())) dateRangeFilter.gte = from;
    }
    if (toDate) {
      const to = new Date(toDate);
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        dateRangeFilter.lte = to;
      }
    }

    const normalizedSearch = search.toUpperCase();
    const matchesStatus = LOG_STATUSES.includes(normalizedSearch as LogStatus);
    const matchesPriority = PRIORITIES.includes(normalizedSearch as Priority);

    const dateFilterWhere =
      Object.keys(dateRangeFilter).length > 0
        ? dateField === "all"
          ? {
              OR: [
                { lastContactDate: dateRangeFilter },
                { followUpDate: dateRangeFilter },
                { meetingDate: dateRangeFilter },
              ],
            }
          : { [dateField]: dateRangeFilter }
        : {};

    const where: Prisma.LogWhereInput = {
      ...(brandId ? { brandId } : {}),
      ...dateFilterWhere,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
              ...(matchesStatus ? [{ status: { equals: normalizedSearch as LogStatus } }] : []),
              ...(matchesPriority ? [{ priority: { equals: normalizedSearch as Priority } }] : []),
              { contact: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const logs = await prisma.log.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true, expectedRevenue: true } },
        contact: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: sort },
      ...(limit ? { take: limit } : {}),
      ...(limit && page ? { skip: (page - 1) * limit } : {}),
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
    const actualRevenue = optionalNonNegativeNumber("actualRevenue", req.body.actualRevenue);

    // Verify brand exists
    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true, ownerId: true } });
    if (!brand) return res.status(404).json({ message: "Brand not found" });

    // Contact must belong to selected brand.
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, brandId },
      select: { id: true },
    });
    if (!contact) return res.status(404).json({ message: "Contact not found for selected brand" });

    const isBoss = req.user!.role === "BOSS";
    if (!isBoss && assignedTo !== brand.ownerId) {
      return res.status(400).json({ message: "assignedTo must be the selected brand owner" });
    }
    if (isBoss) {
      const assignee = await prisma.user.findUnique({
        where: { id: assignedTo },
        select: { id: true },
      });
      if (!assignee) return res.status(404).json({ message: "Assigned user not found" });
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

    await createLogRevision({
      logId: created.id,
      revisionType: LogRevisionType.CREATED,
      changedBy: req.user!.id,
      values: {
        title: created.title,
        brandId: created.brandId,
        contactId: created.contactId,
        status: created.status,
        priority: created.priority,
        assignedTo: created.assignedTo,
        lastContactDate: created.lastContactDate,
        followUpDate: created.followUpDate,
        meetingDate: created.meetingDate,
        actualRevenue:
          created.actualRevenue === null || created.actualRevenue === undefined
            ? null
            : Number(created.actualRevenue),
        notes: created.notes,
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

    const existingLog = await prisma.log.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true, brandId: true },
    });
    if (!existingLog) return res.status(404).json({ message: "Log not found" });

    if (req.body.title !== undefined) {
      const requestedTitle = requireString("title", req.body.title);
      if (requestedTitle !== existingLog.title) {
        return res.status(400).json({ message: "title cannot be changed after log creation" });
      }
    }
    if (req.body.brandId !== undefined) {
      const requestedBrandId = requireString("brandId", req.body.brandId);
      if (requestedBrandId !== existingLog.brandId) {
        return res.status(400).json({ message: "brandId cannot be changed after log creation" });
      }
    }

    const title = existingLog.title;
    const brandId = existingLog.brandId;
    const contactId = requireString("contactId", req.body.contactId);
    const status = requireEnum("status", req.body.status, LOG_STATUSES);
    const priority = requireEnum("priority", req.body.priority, PRIORITIES);
    const assignedTo = requireString("assignedTo", req.body.assignedTo);
    const notes = requireString("notes", req.body.notes);
    const lastContactDate = requireDate("lastContactDate", req.body.lastContactDate);
    const followUpDate = requireDate("followUpDate", req.body.followUpDate);
    const meetingDate = requireDate("meetingDate", req.body.meetingDate);
    const actualRevenue = optionalNonNegativeNumber("actualRevenue", req.body.actualRevenue);

    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true, ownerId: true } });
    if (!brand) return res.status(404).json({ message: "Brand not found" });

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, brandId },
      select: { id: true },
    });
    if (!contact) return res.status(404).json({ message: "Contact not found for selected brand" });

    const isBoss = req.user!.role === "BOSS";
    if (!isBoss && assignedTo !== brand.ownerId) {
      return res.status(400).json({ message: "assignedTo must be the selected brand owner" });
    }
    if (isBoss) {
      const assignee = await prisma.user.findUnique({
        where: { id: assignedTo },
        select: { id: true },
      });
      if (!assignee) return res.status(404).json({ message: "Assigned user not found" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await lockRowOrThrow(tx, "logs", req.params.id, "Log not found");
      return tx.log.update({
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
    });

    await createLogRevision({
      logId: updated.id,
      revisionType: LogRevisionType.UPDATED,
      changedBy: req.user!.id,
      values: {
        title: updated.title,
        brandId: updated.brandId,
        contactId: updated.contactId,
        status: updated.status,
        priority: updated.priority,
        assignedTo: updated.assignedTo,
        lastContactDate: updated.lastContactDate,
        followUpDate: updated.followUpDate,
        meetingDate: updated.meetingDate,
        actualRevenue:
          updated.actualRevenue === null || updated.actualRevenue === undefined
            ? null
            : Number(updated.actualRevenue),
        notes: updated.notes,
      },
    });

    await syncBrandForecastOnClosedWon({ status: updated.status, brandId: updated.brandId });
    return res.json(withExpectedRevenue(updated));
  } catch (err) {
    if (isConcurrentWriteConflict(err)) {
      return res.status(409).json({ message: "Log is being modified by another user. Please retry." });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ message: "Log not found" });
    }
    return next(err);
  }
}

export async function listLogRevisions(req: Request<LogIdParams>, res: Response, next: NextFunction) {
  try {
    const log = await prisma.log.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!log) return res.status(404).json({ message: "Log not found" });

    const revisions = await prisma.logRevision.findMany({
      where: { logId: req.params.id },
      include: {
        changedByUser: { select: { id: true, name: true, email: true, role: true } },
        brand: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { changedAt: "desc" },
    });

    return res.json(revisions.map(withRevisionRevenue));
  } catch (err) {
    return next(err);
  }
}

export async function deleteLog(req: Request<LogIdParams>, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    await assertLogWriteAccessOrThrow(user, req.params.id);
    await prisma.$transaction(async (tx) => {
      await lockRowOrThrow(tx, "logs", req.params.id, "Log not found");
      await tx.logRevision.deleteMany({
        where: { logId: req.params.id },
      });
      await tx.log.delete({ where: { id: req.params.id } });
    });
    return res.status(204).send();
  } catch (err) {
    if (isConcurrentWriteConflict(err)) {
      return res.status(409).json({ message: "Log is being modified by another user. Please retry." });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ message: "Log not found" });
    }
    return next(err);
  }
}

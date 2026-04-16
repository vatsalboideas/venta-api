import { NextFunction, Request, Response } from "express";
import { LogStatus, Priority, Prisma } from "@prisma/client";

import { prisma } from "../prisma";

const MAX_LIMIT = 25;
const DEFAULT_LIMIT = 8;
const MAX_QUERY_LENGTH = 120;

function resolveLimit(rawLimit: unknown): number {
  const parsed = typeof rawLimit === "string" ? Number(rawLimit) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

export async function globalSearch(req: Request, res: Response, next: NextFunction) {
  try {
    const rawQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const q = rawQuery.slice(0, MAX_QUERY_LENGTH);
    const limit = resolveLimit(req.query.limit);

    if (!q || q.length < 2) {
      return res.json({
        query: q,
        users: [],
        brands: [],
        contacts: [],
        logs: [],
      });
    }

    const normalized = q.toUpperCase();
    const matchesStatus = Object.values(LogStatus).includes(normalized as LogStatus);
    const matchesPriority = Object.values(Priority).includes(normalized as Priority);

    const [users, brands, contacts, logs] = await Promise.all([
      prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { department: { contains: q, mode: "insensitive" } },
            { position: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.brand.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { industry: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { owner: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        select: { id: true, name: true, industry: true, priority: true, ownerId: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.contact.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { position: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { brand: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        select: { id: true, name: true, position: true, email: true, phone: true, brandId: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.log.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { notes: { contains: q, mode: "insensitive" } },
            { contact: { name: { contains: q, mode: "insensitive" } } },
            { brand: { name: { contains: q, mode: "insensitive" } } },
            ...(matchesStatus ? [{ status: { equals: normalized as LogStatus } }] : []),
            ...(matchesPriority ? [{ priority: { equals: normalized as Priority } }] : []),
          ],
        } satisfies Prisma.LogWhereInput,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          brandId: true,
          contactId: true,
          assignedTo: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    return res.json({
      query: q,
      users,
      brands,
      contacts,
      logs,
    });
  } catch (error) {
    return next(error);
  }
}

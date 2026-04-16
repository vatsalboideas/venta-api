import { Request, Response, NextFunction } from "express";
import { Prisma, Role } from "@prisma/client";

import { assertContactWriteAccessOrThrow } from "../middleware/authz";
import { prisma } from "../prisma";
import { requireEmail, requireString } from "../utils/validate";

type ContactIdParams = { id: string };

export async function listContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const brandId = typeof req.query.brandId === "string" ? req.query.brandId.trim() : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const rawPage = typeof req.query.page === "string" ? Number(req.query.page) : NaN;
    const rawLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : NaN;
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : undefined;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : undefined;

    const where: Prisma.ContactWhereInput = {};
    if (brandId) where.brandId = brandId;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { position: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
        { creator: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const contacts = await prisma.contact.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true, ownerId: true } },
        creator: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: page && limit ? (page - 1) * limit : undefined,
      take: limit,
    });
    return res.json(contacts);
  } catch (err) {
    return next(err);
  }
}

export async function getContact(req: Request<ContactIdParams>, res: Response, next: NextFunction) {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
      include: {
        brand: { select: { id: true, name: true, ownerId: true } },
        creator: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    return res.json(contact);
  } catch (err) {
    return next(err);
  }
}

export async function createContact(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const brandId = requireString("brandId", req.body.brandId);
    const name = requireString("name", req.body.name);

    // Verify brand exists
    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } });
    if (!brand) return res.status(404).json({ message: "Brand not found" });

    const { address } = req.body as {
      address?: string;
    };
    const position = requireString("position", req.body.position);
    const email = requireEmail("email", req.body.email);
    const phone = requireString("phone", req.body.phone);

    const created = await prisma.contact.create({
      data: { brandId, name, position, email, phone, address, createdBy: user.id },
      include: {
        brand: { select: { id: true, name: true, ownerId: true } },
        creator: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
}

export async function updateContact(req: Request<ContactIdParams>, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    await assertContactWriteAccessOrThrow(user, req.params.id);
    const existingContact = await prisma.contact.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, brandId: true },
    });
    if (!existingContact) return res.status(404).json({ message: "Contact not found" });

    const { name, position, email, phone, address, brandId, createdBy } = req.body as Record<string, unknown>;
    if (position === undefined) return res.status(400).json({ message: "position is required" });
    if (email === undefined) return res.status(400).json({ message: "email is required" });
    if (phone === undefined) return res.status(400).json({ message: "phone is required" });
    const parsedPosition = requireString("position", position);
    const parsedEmail = requireEmail("email", email);
    const parsedPhone = requireString("phone", phone);
    const parsedName = name !== undefined ? requireString("name", name) : undefined;
    const parsedBrandId = brandId !== undefined ? requireString("brandId", brandId) : undefined;

    if (user.role !== Role.BOSS) {
      if (parsedName !== undefined && parsedName !== existingContact.name) {
        return res.status(403).json({ message: "Employees cannot change contact name" });
      }
      if (parsedBrandId !== undefined && parsedBrandId !== existingContact.brandId) {
        return res.status(403).json({ message: "Employees cannot change contact brand" });
      }
    }

    // Verify new brandId if being changed
    if (parsedBrandId !== undefined) {
      const brand = await prisma.brand.findUnique({ where: { id: parsedBrandId }, select: { id: true } });
      if (!brand) return res.status(404).json({ message: "Brand not found" });
    }

    const updated = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        name: user.role === Role.BOSS ? parsedName : undefined,
        position: parsedPosition,
        email: parsedEmail,
        phone: parsedPhone,
        address: address as string | undefined,
        brandId: user.role === Role.BOSS ? parsedBrandId : undefined,
        createdBy: user.role === Role.BOSS ? (createdBy as string | undefined) : undefined,
      },
    });

    return res.json(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ message: "Contact not found" });
    }
    return next(err);
  }
}

export async function deleteContact(req: Request<ContactIdParams>, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    await assertContactWriteAccessOrThrow(user, req.params.id);
    await prisma.contact.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ message: "Contact not found" });
    }
    return next(err);
  }
}

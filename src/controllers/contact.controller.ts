import { Request, Response, NextFunction } from "express";
import { Prisma, Role } from "@prisma/client";

import { assertContactWriteAccessOrThrow } from "../middleware/authz";
import { prisma } from "../prisma";
import { requireEmail, requireString } from "../utils/validate";

type ContactIdParams = { id: string };

export async function listContacts(_req: Request, res: Response, next: NextFunction) {
  try {
    const contacts = await prisma.contact.findMany({
      include: {
        brand: { select: { id: true, name: true, ownerId: true } },
        creator: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
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

    const { name, position, email, phone, address, brandId, createdBy } = req.body as Record<string, unknown>;
    if (position === undefined) return res.status(400).json({ message: "position is required" });
    if (email === undefined) return res.status(400).json({ message: "email is required" });
    if (phone === undefined) return res.status(400).json({ message: "phone is required" });
    const parsedPosition = requireString("position", position);
    const parsedEmail = requireEmail("email", email);
    const parsedPhone = requireString("phone", phone);

    // Verify new brandId if being changed
    if (brandId !== undefined) {
      const brand = await prisma.brand.findUnique({ where: { id: brandId as string }, select: { id: true } });
      if (!brand) return res.status(404).json({ message: "Brand not found" });
    }

    const updated = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        name: name as string | undefined,
        position: parsedPosition,
        email: parsedEmail,
        phone: parsedPhone,
        address: address as string | undefined,
        brandId: brandId as string | undefined,
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

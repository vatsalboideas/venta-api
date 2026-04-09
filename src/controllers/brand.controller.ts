import { ForecastCategory, Priority, Role } from "@prisma/client";
import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";

import { assertBrandWriteAccessOrThrow } from "../middleware/authz";
import { prisma } from "../prisma";
import {
  requireEmail,
  ValidationError,
  optionalEnum,
  requireEnum,
  requireNonNegativeNumber,
  requireString,
} from "../utils/validate";

type BrandIdParams = { id: string };

const PRIORITIES = Object.values(Priority) as Priority[];
const FORECAST_CATEGORIES = Object.values(ForecastCategory) as ForecastCategory[];
type NewBrandContactInput = {
  name: string;
  position: string;
  email: string;
  phone: string;
  address?: string;
};

function parseExistingContactIds(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationError("existingContactIds must be an array of contact IDs");
  return value
    .map((id, index) => {
      if (typeof id !== "string" || id.trim() === "") {
        throw new ValidationError(`existingContactIds[${index}] must be a non-empty string`);
      }
      return id.trim();
    })
    .filter((id, idx, arr) => arr.indexOf(id) === idx);
}

function parseNewContacts(value: unknown): NewBrandContactInput[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationError("newContacts must be an array");
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new ValidationError(`newContacts[${index}] must be an object`);
    const item = raw as Record<string, unknown>;
    const name = requireString(`newContacts[${index}].name`, item.name);
    const position = requireString(`newContacts[${index}].position`, item.position);
    const email = requireEmail(`newContacts[${index}].email`, item.email);
    const phone = requireString(`newContacts[${index}].phone`, item.phone);
    return {
      name,
      position,
      email,
      phone,
      address: typeof item.address === "string" && item.address.trim() ? item.address.trim() : undefined,
    };
  });
}

export async function listBrands(_req: Request, res: Response, next: NextFunction) {
  try {
    const brands = await prisma.brand.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
        contacts: { select: { id: true, name: true, position: true, email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(brands);
  } catch (err) {
    return next(err);
  }
}

export async function getBrand(req: Request<BrandIdParams>, res: Response, next: NextFunction) {
  try {
    const brand = await prisma.brand.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
        contacts: { select: { id: true, name: true, position: true, email: true, phone: true } },
      },
    });
    if (!brand) return res.status(404).json({ message: "Brand not found" });
    return res.json(brand);
  } catch (err) {
    return next(err);
  }
}

export async function createBrand(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const name = requireString("name", req.body.name);
    const priority = requireEnum("priority", req.body.priority, PRIORITIES);
    const expectedRevenue = requireNonNegativeNumber("expectedRevenue", req.body.expectedRevenue);
    const forecastCategory = optionalEnum("forecastCategory", req.body.forecastCategory, FORECAST_CATEGORIES);
    const existingContactIds = parseExistingContactIds(req.body.existingContactIds);
    const newContacts = parseNewContacts(req.body.newContacts);
    if (existingContactIds.length === 0 && newContacts.length === 0) {
      throw new ValidationError("At least one contact is required. Provide existingContactIds or newContacts.");
    }

    const { website, description, ownerId: rawOwnerId } = req.body as {
      website?: string;
      description?: string;
      ownerId?: string;
    };
    const industry = requireString("industry", req.body.industry);

    let ownerId = user.id;
    if (user.role === Role.BOSS && rawOwnerId) {
      const ownerExists = await prisma.user.findUnique({ where: { id: rawOwnerId }, select: { id: true } });
      if (!ownerExists) return res.status(404).json({ message: "Specified owner user not found" });
      ownerId = rawOwnerId;
    }

    const created = await prisma.$transaction(async (tx) => {
      if (existingContactIds.length > 0) {
        const matched = await tx.contact.findMany({
          where: { id: { in: existingContactIds } },
          select: { id: true },
        });
        if (matched.length !== existingContactIds.length) {
          throw new ValidationError("One or more existingContactIds are invalid.");
        }
      }

      const brand = await tx.brand.create({
        data: {
          name,
          industry,
          priority,
          forecastCategory: forecastCategory ?? ForecastCategory.PIPELINE,
          expectedRevenue,
          website,
          description,
          ownerId,
        },
      });

      if (existingContactIds.length > 0) {
        await tx.contact.updateMany({
          where: { id: { in: existingContactIds } },
          data: { brandId: brand.id },
        });
      }

      if (newContacts.length > 0) {
        await tx.contact.createMany({
          data: newContacts.map((contact) => ({
            brandId: brand.id,
            createdBy: req.user!.id,
            name: contact.name,
            position: contact.position,
            email: contact.email,
            phone: contact.phone,
            address: contact.address,
          })),
        });
      }

      return tx.brand.findUniqueOrThrow({
        where: { id: brand.id },
        include: {
          owner: { select: { id: true, name: true, email: true, role: true } },
          contacts: { select: { id: true, name: true, position: true, email: true, phone: true } },
        },
      });
    });

    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
}

export async function updateBrand(req: Request<BrandIdParams>, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    await assertBrandWriteAccessOrThrow(user, req.params.id);

    const priority = optionalEnum("priority", req.body.priority, PRIORITIES);
    const forecastCategory = optionalEnum("forecastCategory", req.body.forecastCategory, FORECAST_CATEGORIES);
    const hasExistingContactIds = Object.prototype.hasOwnProperty.call(req.body, "existingContactIds");
    const existingContactIds = parseExistingContactIds(req.body.existingContactIds);
    const newContacts = parseNewContacts(req.body.newContacts);
    if (hasExistingContactIds && existingContactIds.length === 0 && newContacts.length === 0) {
      throw new ValidationError("At least one contact must stay attached to the brand.");
    }

    const { name, industry, expectedRevenue, website, description, ownerId: rawOwnerId } = req.body as Record<string, unknown>;
    if (industry === undefined) {
      throw new ValidationError("industry is required");
    }
    const parsedIndustry = requireString("industry", industry);

    const parsedExpectedRevenue =
      expectedRevenue !== undefined ? requireNonNegativeNumber("expectedRevenue", expectedRevenue) : undefined;

    let resolvedOwnerId: string | undefined;
    if (user.role === Role.BOSS && rawOwnerId !== undefined) {
      const ownerExists = await prisma.user.findUnique({ where: { id: rawOwnerId as string }, select: { id: true } });
      if (!ownerExists) return res.status(404).json({ message: "Specified owner user not found" });
      resolvedOwnerId = rawOwnerId as string;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (existingContactIds.length > 0) {
        const matched = await tx.contact.findMany({
          where: { id: { in: existingContactIds } },
          select: { id: true },
        });
        if (matched.length !== existingContactIds.length) {
          throw new ValidationError("One or more existingContactIds are invalid.");
        }
      }

      const brand = await tx.brand.update({
        where: { id: req.params.id },
        data: {
          name: name as string | undefined,
          industry: parsedIndustry,
          priority,
          forecastCategory,
          expectedRevenue: parsedExpectedRevenue,
          website: website as string | undefined,
          description: description as string | undefined,
          ownerId: resolvedOwnerId,
        },
      });

      if (hasExistingContactIds) {
        await tx.contact.updateMany({
          where: {
            brandId: brand.id,
            id: { notIn: existingContactIds },
          },
          data: { brandId: null },
        });
      }

      if (existingContactIds.length > 0) {
        await tx.contact.updateMany({
          where: { id: { in: existingContactIds } },
          data: { brandId: brand.id },
        });
      }

      if (newContacts.length > 0) {
        await tx.contact.createMany({
          data: newContacts.map((contact) => ({
            brandId: brand.id,
            createdBy: req.user!.id,
            name: contact.name,
            position: contact.position,
            email: contact.email,
            phone: contact.phone,
            address: contact.address,
          })),
        });
      }

      return tx.brand.findUniqueOrThrow({
        where: { id: brand.id },
        include: {
          owner: { select: { id: true, name: true, email: true, role: true } },
          contacts: { select: { id: true, name: true, position: true, email: true, phone: true } },
        },
      });
    });

    return res.json(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ message: "Brand not found" });
    }
    return next(err);
  }
}

export async function deleteBrand(req: Request<BrandIdParams>, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    await assertBrandWriteAccessOrThrow(user, req.params.id);
    await prisma.brand.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ message: "Brand not found" });
    }
    return next(err);
  }
}

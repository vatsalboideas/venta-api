import { Priority, Role } from "@prisma/client";
import { Request, Response } from "express";

import { assertBrandWriteAccessOrThrow } from "../middleware/authz";
import { prisma } from "../prisma";

type BrandIdParams = { id: string };

function sanitizeBrandPayload(req: Request) {
  const { name, industry, priority, forecastCategory, expectedRevenue, website, description, ownerId } = req.body;
  return {
    name,
    industry,
    priority,
    forecastCategory,
    expectedRevenue,
    website,
    description,
    ownerId,
  };
}

export async function listBrands(_req: Request, res: Response) {
  const brands = await prisma.brand.findMany({
    include: { owner: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });
  return res.json(brands);
}

export async function getBrand(req: Request<BrandIdParams>, res: Response) {
  const brand = await prisma.brand.findUnique({
    where: { id: req.params.id },
    include: { owner: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!brand) return res.status(404).json({ message: "Brand not found" });
  return res.json(brand);
}

export async function createBrand(req: Request, res: Response) {
  const user = req.user!;
  const payload = sanitizeBrandPayload(req);

  const ownerId = user.role === Role.BOSS ? payload.ownerId ?? user.id : user.id;

  if (!Object.values(Priority).includes(payload.priority)) {
    return res.status(400).json({ message: "Invalid priority" });
  }

  const created = await prisma.brand.create({
    data: {
      name: payload.name,
      industry: payload.industry,
      priority: payload.priority,
      forecastCategory: payload.forecastCategory,
      expectedRevenue: payload.expectedRevenue,
      website: payload.website,
      description: payload.description,
      ownerId,
    },
  });

  return res.status(201).json(created);
}

export async function updateBrand(req: Request<BrandIdParams>, res: Response) {
  const user = req.user!;
  try {
    await assertBrandWriteAccessOrThrow(user, req.params.id);
  } catch (err) {
    const e = err as Error & { status?: number };
    return res.status(e.status ?? 500).json({ message: e.message });
  }

  const payload = sanitizeBrandPayload(req);
  const data = {
    name: payload.name,
    industry: payload.industry,
    priority: payload.priority,
    forecastCategory: payload.forecastCategory,
    expectedRevenue: payload.expectedRevenue,
    website: payload.website,
    description: payload.description,
    ownerId: user.role === Role.BOSS ? payload.ownerId : undefined,
  };

  const updated = await prisma.brand.update({
    where: { id: req.params.id },
    data,
  });

  return res.json(updated);
}

export async function deleteBrand(req: Request<BrandIdParams>, res: Response) {
  const user = req.user!;
  try {
    await assertBrandWriteAccessOrThrow(user, req.params.id);
  } catch (err) {
    const e = err as Error & { status?: number };
    return res.status(e.status ?? 500).json({ message: e.message });
  }

  await prisma.brand.delete({ where: { id: req.params.id } });
  return res.status(204).send();
}

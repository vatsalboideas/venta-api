import { ForecastCategory, LogStatus, Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function syncBrandForecastOnClosedWon(args: {
  status: LogStatus;
  brandId: string;
}) {
  if (args.status !== LogStatus.CLOSED_WON) return;

  await prisma.brand.update({
    where: { id: args.brandId },
    data: { forecastCategory: ForecastCategory.CLOSED },
  });
}

export function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value ? Number(value) : null;
}

import { ForecastCategory, LogStatus, Prisma, PrismaClient } from "@prisma/client";
import { decryptDbResult, encryptDbWriteArgs } from "./utils/db-encryption";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const basePrisma = globalForPrisma.prisma ?? new PrismaClient();

const SOFT_DELETE_MODELS = new Set(["User", "Brand", "Contact", "Log", "LogRevision", "Department", "EmployeeType"]);

function modelDelegate(model: string) {
  const key = `${model.charAt(0).toLowerCase()}${model.slice(1)}`;
  return (basePrisma as unknown as Record<string, unknown>)[key] as {
    findFirst: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<unknown>;
    aggregate: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<unknown>;
  };
}

function withActiveWhere<T extends { where?: Record<string, unknown> }>(args: T): T {
  return {
    ...args,
    where: { ...(args.where ?? {}), deletedAt: null },
  };
}

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const encryptedArgs =
          model && (operation === "create" || operation === "createMany" || operation === "update" || operation === "updateMany" || operation === "upsert")
            ? encryptDbWriteArgs(model, args)
            : args;

        if (!model || !SOFT_DELETE_MODELS.has(model)) {
          const result = await query(encryptedArgs as never);
          return decryptDbResult(result);
        }

        const delegate = modelDelegate(model);

        if (operation === "findUnique") {
          const result = await delegate.findFirst(withActiveWhere(encryptedArgs as { where?: Record<string, unknown> }));
          return decryptDbResult(result);
        }
        if (operation === "findFirst" || operation === "findMany" || operation === "count" || operation === "aggregate") {
          const result = await query(withActiveWhere(encryptedArgs as { where?: Record<string, unknown> }) as never);
          return decryptDbResult(result);
        }
        if (operation === "update" || operation === "updateMany") {
          const result = await query(withActiveWhere(encryptedArgs as { where?: Record<string, unknown> }) as never);
          return decryptDbResult(result);
        }
        if (operation === "delete") {
          const deleteArgs = encryptedArgs as { where: Record<string, unknown> };
          const result = await delegate.update(withActiveWhere({ where: deleteArgs.where, data: { deletedAt: new Date() } }));
          return decryptDbResult(result);
        }
        if (operation === "deleteMany") {
          const deleteManyArgs = encryptedArgs as { where?: Record<string, unknown> };
          const result = await delegate.updateMany(withActiveWhere({ where: deleteManyArgs.where, data: { deletedAt: new Date() } }));
          return decryptDbResult(result);
        }

        const result = await query(encryptedArgs as never);
        return decryptDbResult(result);
      },
    },
  },
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
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

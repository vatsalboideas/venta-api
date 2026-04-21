import { Prisma } from "@prisma/client";

type TxClient = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

export class ConflictError extends Error {
  status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export async function lockRowOrThrow(tx: TxClient, table: string, id: string, notFoundMessage: string) {
  const allowedTables = new Set([
    "users",
    "brands",
    "contacts",
    "logs",
    "departments",
    "employee_types",
  ]);
  if (!allowedTables.has(table)) {
    throw new Error(`Unsupported table lock target: ${table}`);
  }

  const rows = await tx.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${table}" WHERE id = $1 FOR UPDATE NOWAIT`,
    id,
  );
  if (rows.length === 0) {
    const err = new Error(notFoundMessage) as Error & { status?: number };
    err.status = 404;
    throw err;
  }
}

export function isConcurrentWriteConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2010") return false;
  const meta = error.meta as { code?: string } | undefined;
  return meta?.code === "55P03";
}

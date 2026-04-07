-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BOSS', 'EMPLOYEE', 'INTERN');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ForecastCategory" AS ENUM ('PIPELINE', 'COMMIT', 'CLOSED');

-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('COLD_LEAD', 'MEET_PRESENT', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "2fa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "position" TEXT,
    "department" TEXT,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "priority" "Priority" NOT NULL,
    "forecast_category" "ForecastCategory" NOT NULL DEFAULT 'PIPELINE',
    "expected_revenue" DECIMAL(14,2) NOT NULL,
    "website" TEXT,
    "description" TEXT,
    "owner_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "created_by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "status" "LogStatus" NOT NULL,
    "priority" "Priority" NOT NULL,
    "assigned_to" TEXT NOT NULL,
    "last_contact_date" TIMESTAMP(3),
    "follow_up_date" TIMESTAMP(3),
    "meeting_date" TIMESTAMP(3),
    "actual_revenue" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "brands_owner_id_idx" ON "brands"("owner_id");

-- CreateIndex
CREATE INDEX "contacts_brand_id_idx" ON "contacts"("brand_id");

-- CreateIndex
CREATE INDEX "contacts_created_by_idx" ON "contacts"("created_by");

-- CreateIndex
CREATE INDEX "logs_brand_id_idx" ON "logs"("brand_id");

-- CreateIndex
CREATE INDEX "logs_contact_id_idx" ON "logs"("contact_id");

-- CreateIndex
CREATE INDEX "logs_assigned_to_idx" ON "logs"("assigned_to");

-- CreateIndex
CREATE INDEX "logs_status_idx" ON "logs"("status");

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

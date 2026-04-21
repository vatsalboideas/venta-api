/*
  Warnings:

  - You are about to drop the column `created_at` on the `departments` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `departments` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `departments` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "brands_description_trgm_idx";

-- DropIndex
DROP INDEX "brands_industry_trgm_idx";

-- DropIndex
DROP INDEX "brands_name_trgm_idx";

-- DropIndex
DROP INDEX "contacts_email_trgm_idx";

-- DropIndex
DROP INDEX "contacts_name_trgm_idx";

-- DropIndex
DROP INDEX "contacts_phone_trgm_idx";

-- DropIndex
DROP INDEX "contacts_position_trgm_idx";

-- DropIndex
DROP INDEX "logs_notes_trgm_idx";

-- DropIndex
DROP INDEX "logs_title_trgm_idx";

-- DropIndex
DROP INDEX "users_email_trgm_idx";

-- DropIndex
DROP INDEX "users_name_trgm_idx";

-- DropIndex
DROP INDEX "users_phone_trgm_idx";

-- AlterTable
ALTER TABLE "departments" DROP COLUMN "created_at",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

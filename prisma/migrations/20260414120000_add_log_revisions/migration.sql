-- CreateEnum
CREATE TYPE "LogRevisionType" AS ENUM ('CREATED', 'UPDATED');

-- CreateTable
CREATE TABLE "log_revisions" (
    "id" TEXT NOT NULL,
    "log_id" TEXT NOT NULL,
    "revision_type" "LogRevisionType" NOT NULL,
    "title" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "status" "LogStatus" NOT NULL,
    "priority" "Priority" NOT NULL,
    "assigned_to" TEXT NOT NULL,
    "last_contact_date" TIMESTAMP(3) NOT NULL,
    "follow_up_date" TIMESTAMP(3) NOT NULL,
    "meeting_date" TIMESTAMP(3) NOT NULL,
    "actual_revenue" DECIMAL(14,2) NOT NULL,
    "notes" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "log_revisions_log_id_changed_at_idx" ON "log_revisions"("log_id", "changed_at");

-- CreateIndex
CREATE INDEX "log_revisions_changed_by_idx" ON "log_revisions"("changed_by");

-- AddForeignKey
ALTER TABLE "log_revisions" ADD CONSTRAINT "log_revisions_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_revisions" ADD CONSTRAINT "log_revisions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_revisions" ADD CONSTRAINT "log_revisions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_revisions" ADD CONSTRAINT "log_revisions_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_revisions" ADD CONSTRAINT "log_revisions_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

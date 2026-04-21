ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "brands" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "contacts" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "logs" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "log_revisions" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
CREATE INDEX "brands_deleted_at_idx" ON "brands"("deleted_at");
CREATE INDEX "contacts_deleted_at_idx" ON "contacts"("deleted_at");
CREATE INDEX "logs_deleted_at_idx" ON "logs"("deleted_at");
CREATE INDEX "log_revisions_deleted_at_idx" ON "log_revisions"("deleted_at");

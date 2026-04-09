-- Alter users table to track who created each employee/intern.
ALTER TABLE "users"
ADD COLUMN "created_by" TEXT;

ALTER TABLE "users"
ADD CONSTRAINT "users_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "users_created_by_idx" ON "users"("created_by");

-- Backfill required log fields before adding NOT NULL constraints.
UPDATE "logs"
SET "contact_id" = c.id
FROM "contacts" c
WHERE "logs"."contact_id" IS NULL
  AND c."brand_id" = "logs"."brand_id";

UPDATE "logs"
SET "notes" = ''
WHERE "notes" IS NULL;

UPDATE "logs"
SET "actual_revenue" = 0
WHERE "actual_revenue" IS NULL;

UPDATE "logs"
SET "last_contact_date" = COALESCE("last_contact_date", "createdAt")
WHERE "last_contact_date" IS NULL;

UPDATE "logs"
SET "follow_up_date" = COALESCE("follow_up_date", "last_contact_date", "createdAt")
WHERE "follow_up_date" IS NULL;

UPDATE "logs"
SET "meeting_date" = COALESCE("meeting_date", "follow_up_date", "createdAt")
WHERE "meeting_date" IS NULL;

-- Enforce required columns.
ALTER TABLE "logs" ALTER COLUMN "contact_id" SET NOT NULL;
ALTER TABLE "logs" ALTER COLUMN "last_contact_date" SET NOT NULL;
ALTER TABLE "logs" ALTER COLUMN "follow_up_date" SET NOT NULL;
ALTER TABLE "logs" ALTER COLUMN "meeting_date" SET NOT NULL;
ALTER TABLE "logs" ALTER COLUMN "actual_revenue" SET NOT NULL;
ALTER TABLE "logs" ALTER COLUMN "notes" SET NOT NULL;

-- Ensure required contact cannot be deleted out from under a log.
ALTER TABLE "logs" DROP CONSTRAINT "logs_contact_id_fkey";
ALTER TABLE "logs"
  ADD CONSTRAINT "logs_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

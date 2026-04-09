-- Make brand industry required.
UPDATE "brands" SET "industry" = '' WHERE "industry" IS NULL;
ALTER TABLE "brands" ALTER COLUMN "industry" SET NOT NULL;

-- Make contact profile fields required.
UPDATE "contacts" SET "position" = '' WHERE "position" IS NULL;
UPDATE "contacts" SET "email" = '' WHERE "email" IS NULL;
UPDATE "contacts" SET "phone" = '' WHERE "phone" IS NULL;
ALTER TABLE "contacts" ALTER COLUMN "position" SET NOT NULL;
ALTER TABLE "contacts" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "contacts" ALTER COLUMN "phone" SET NOT NULL;

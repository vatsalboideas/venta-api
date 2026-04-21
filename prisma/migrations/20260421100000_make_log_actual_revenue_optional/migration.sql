-- Make actual_revenue optional for logs and log revisions.
ALTER TABLE "logs"
ALTER COLUMN "actual_revenue" DROP NOT NULL;

ALTER TABLE "log_revisions"
ALTER COLUMN "actual_revenue" DROP NOT NULL;

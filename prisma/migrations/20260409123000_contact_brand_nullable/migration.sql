-- Make contact.brand_id nullable so brand edit can detach contacts.
ALTER TABLE "contacts"
ALTER COLUMN "brand_id" DROP NOT NULL;

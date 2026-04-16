CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS users_name_trgm_idx ON users USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_email_trgm_idx ON users USING GIN (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_phone_trgm_idx ON users USING GIN (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS brands_name_trgm_idx ON brands USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS brands_industry_trgm_idx ON brands USING GIN (industry gin_trgm_ops);
CREATE INDEX IF NOT EXISTS brands_description_trgm_idx ON brands USING GIN (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS contacts_name_trgm_idx ON contacts USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS contacts_email_trgm_idx ON contacts USING GIN (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS contacts_phone_trgm_idx ON contacts USING GIN (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS contacts_position_trgm_idx ON contacts USING GIN (position gin_trgm_ops);

CREATE INDEX IF NOT EXISTS logs_title_trgm_idx ON logs USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS logs_notes_trgm_idx ON logs USING GIN (notes gin_trgm_ops);

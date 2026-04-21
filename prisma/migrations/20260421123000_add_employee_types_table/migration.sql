CREATE TABLE "employee_types" (
  "id" TEXT NOT NULL,
  "code" "Role" NOT NULL,
  "label" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "employee_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_types_code_key" ON "employee_types"("code");
CREATE INDEX "employee_types_deleted_at_idx" ON "employee_types"("deleted_at");

INSERT INTO "employee_types" ("id", "code", "label", "updated_at")
VALUES
  ('type-boss', 'BOSS', 'Boss', CURRENT_TIMESTAMP),
  ('type-manager', 'MANAGER', 'Manager', CURRENT_TIMESTAMP),
  ('type-employee', 'EMPLOYEE', 'Employee', CURRENT_TIMESTAMP),
  ('type-intern', 'INTERN', 'Intern', CURRENT_TIMESTAMP);

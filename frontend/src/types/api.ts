export type Role = "BOSS" | "MANAGER" | "EMPLOYEE" | "INTERN";
export type Priority = "HIGH" | "MEDIUM" | "LOW";
export type ForecastCategory = "PIPELINE" | "COMMIT" | "CLOSED";
export type LogStatus =
  | "COLD_LEAD"
  | "MEET_PRESENT"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "CLOSED_WON"
  | "CLOSED_LOST";

export const PRIORITIES: Priority[] = ["HIGH", "MEDIUM", "LOW"];
export const FORECAST_CATEGORIES: ForecastCategory[] = ["PIPELINE", "COMMIT", "CLOSED"];
export const LOG_STATUSES: LogStatus[] = [
  "COLD_LEAD",
  "MEET_PRESENT",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
];

// ── Auth ──────────────────────────────────────────────────────────────────────

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  department?: string | null;
  position?: string | null;
  twoFAEnabled?: boolean;
  createdBy?: string | null;
  creator?: Pick<User, "id" | "name" | "email" | "role"> | null;
  createdAt?: string;
  updatedAt?: string;
};
export type Department = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};
export type EmployeeType = {
  id: string;
  code: Role;
  label: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  position?: string;
  department?: string;
  role?: "EMPLOYEE" | "INTERN";
};

export type RegisterResponse = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type LoginRequest = { email: string; password: string };

export type LoginResponse =
  | { requiresTwoFactor: true; tempToken: string }
  | { requiresTwoFactor: false; accessToken: string; user: User };

export type VerifyTwoFARequest = { tempToken: string; token: string };
export type VerifyTwoFAResponse = { accessToken: string; user: User };

export type Setup2FAResponse = {
  message: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
};

export type Verify2FASetupRequest = { token: string };
export type Disable2FARequest = { token: string };
export type CreateInternRequest = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: "MANAGER" | "EMPLOYEE" | "INTERN";
  position?: string;
  department?: string;
};
export type UpdateUserRequest = {
  name?: string;
  email?: string;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
  role?: "MANAGER" | "EMPLOYEE" | "INTERN";
};
export type DeleteUserRequest = {
  id: string;
  transferToUserId?: string;
};
export type DepartmentRequest = { name: string };
export type EmployeeTypeRequest = { code: Role; label: string };

// ── Brand ─────────────────────────────────────────────────────────────────────

export type Brand = {
  id: string;
  name: string;
  industry: string;
  priority: Priority;
  forecastCategory: ForecastCategory;
  expectedRevenue: number | string;
  website?: string | null;
  description?: string | null;
  ownerId: string;
  owner?: Pick<User, "id" | "name" | "email" | "role">;
  contacts?: Array<Pick<Contact, "id" | "name" | "position" | "email" | "phone">>;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateBrandRequest = {
  name: string;
  priority: Priority;
  expectedRevenue: number;
  industry: string;
  forecastCategory?: ForecastCategory;
  website?: string;
  description?: string;
  ownerId?: string;
  existingContactIds?: string[];
  newContacts?: Array<{
    name: string;
    position: string;
    email: string;
    phone: string;
    address?: string;
  }>;
};

export type UpdateBrandRequest = Partial<CreateBrandRequest>;

// ── Contact ───────────────────────────────────────────────────────────────────

export type Contact = {
  id: string;
  brandId: string | null;
  name: string;
  position: string;
  email: string;
  phone: string;
  address?: string | null;
  createdBy: string;
  brand?: Pick<Brand, "id" | "name" | "ownerId">;
  creator?: Pick<User, "id" | "name" | "email" | "role">;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateContactRequest = {
  brandId: string;
  name: string;
  position: string;
  email: string;
  phone: string;
  address?: string;
};

export type UpdateContactRequest = Partial<CreateContactRequest> & { createdBy?: string };

// ── Log ───────────────────────────────────────────────────────────────────────

export type LogItem = {
  id: string;
  title: string;
  brandId: string;
  contactId: string;
  status: LogStatus;
  priority: Priority;
  assignedTo: string;
  lastContactDate: string;
  followUpDate: string;
  meetingDate: string;
  actualRevenue: number | null;
  expectedRevenue?: number;
  notes: string;
  brand?: Pick<Brand, "id" | "name" | "expectedRevenue">;
  contact?: Pick<Contact, "id" | "name">;
  assignee?: Pick<User, "id" | "name" | "email" | "role">;
  createdAt?: string;
  updatedAt?: string;
};

export type LogRevision = {
  id: string;
  logId: string;
  revisionType: "CREATED" | "UPDATED";
  title: string;
  brandId: string;
  contactId: string;
  status: LogStatus;
  priority: Priority;
  assignedTo: string;
  lastContactDate: string;
  followUpDate: string;
  meetingDate: string;
  actualRevenue: number | null;
  notes: string;
  changedBy: string;
  changedAt: string;
  brand?: Pick<Brand, "id" | "name">;
  contact?: Pick<Contact, "id" | "name">;
  assignee?: Pick<User, "id" | "name" | "email" | "role">;
  changedByUser?: Pick<User, "id" | "name" | "email" | "role">;
};

export type CreateLogRequest = {
  title: string;
  brandId: string;
  contactId: string;
  status: LogStatus;
  priority: Priority;
  assignedTo: string;
  lastContactDate: string;
  followUpDate: string;
  meetingDate: string;
  actualRevenue?: number | null;
  notes: string;
};

export type UpdateLogRequest = Partial<CreateLogRequest>;

// ── Analytics ─────────────────────────────────────────────────────────────────

export type RevenueTrendItem = { bucket: string; revenue: number };
export type ConversionRateResponse = {
  totalLogs: number;
  closedWonLogs: number;
  conversionRatePercent: number;
};
export type LeaderboardItem = {
  userId: string;
  userName: string;
  totalRevenue: number;
  rank: number;
};

export type GlobalSearchResponse = {
  query: string;
  users: Array<Pick<User, "id" | "name" | "email" | "role">>;
  brands: Array<Pick<Brand, "id" | "name" | "industry" | "priority" | "ownerId">>;
  contacts: Array<Pick<Contact, "id" | "name" | "position" | "email" | "phone" | "brandId">>;
  logs: Array<Pick<LogItem, "id" | "title" | "status" | "priority" | "brandId" | "contactId" | "assignedTo">>;
};

import { Role } from "@prisma/client";

export type AuthUser = {
  id: string;
  role: Role;
};

export type RequestWithUser = {
  user?: AuthUser;
};

import { Router } from "express";

import {
  createEmployeeType,
  deleteEmployeeType,
  listEmployeeTypes,
  updateEmployeeType,
} from "../controllers/employee-type.controller";
import { requireAuth } from "../middleware/authz";

const router = Router();

router.get("/", requireAuth, listEmployeeTypes);
router.post("/", requireAuth, createEmployeeType);
router.patch("/:id", requireAuth, updateEmployeeType);
router.delete("/:id", requireAuth, deleteEmployeeType);

export default router;

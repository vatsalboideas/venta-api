import { Router } from "express";

import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  updateDepartment,
} from "../controllers/department.controller";
import { requireAuth } from "../middleware/authz";

const router = Router();

router.get("/", requireAuth, listDepartments);
router.post("/", requireAuth, createDepartment);
router.patch("/:id", requireAuth, updateDepartment);
router.delete("/:id", requireAuth, deleteDepartment);

export default router;

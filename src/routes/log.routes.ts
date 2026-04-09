import { Router } from "express";

import {
  createLog,
  deleteLog,
  getLog,
  listLogs,
  updateLog,
} from "../controllers/log.controller";
import { requireAuth } from "../middleware/authz";

const router = Router();

router.use(requireAuth);
router.get("/", listLogs);
router.get("/:id", getLog);
router.post("/", createLog);
router.patch("/:id", updateLog);
router.delete("/:id", deleteLog);

export default router;

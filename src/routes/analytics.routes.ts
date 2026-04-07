import { Router } from "express";

import {
  getConversionRate,
  getLeaderboard,
  getRevenueTrend,
} from "../controllers/analytics.controller";
import { requireAuth } from "../middleware/authz";

const router = Router();

router.use(requireAuth);

router.get("/revenue-trend", getRevenueTrend);
router.get("/conversion-rate", getConversionRate);
router.get("/leaderboard", getLeaderboard);

export default router;

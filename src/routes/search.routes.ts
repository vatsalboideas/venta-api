import { Router } from "express";

import { globalSearch } from "../controllers/search.controller";
import { requireAuth } from "../middleware/authz";
import { searchRateLimit } from "../middleware/search-rate-limit";

const router = Router();

router.use(requireAuth);
router.use(searchRateLimit);
router.get("/", globalSearch);

export default router;

import { Router } from "express";

import {
  createBrand,
  deleteBrand,
  getBrand,
  listBrands,
  updateBrand,
} from "../controllers/brand.controller";
import { requireAuth } from "../middleware/authz";

const router = Router();

router.use(requireAuth);

// READ: all authenticated users
router.get("/", listBrands);
router.get("/:id", getBrand);

// CRUD with role constraints handled inside controllers
router.post("/", createBrand);
router.patch("/:id", updateBrand);
router.delete("/:id", deleteBrand);

export default router;

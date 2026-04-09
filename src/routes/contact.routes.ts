import { Router } from "express";

import {
  createContact,
  deleteContact,
  getContact,
  listContacts,
  updateContact,
} from "../controllers/contact.controller";
import { requireAuth } from "../middleware/authz";

const router = Router();

router.use(requireAuth);
router.get("/", listContacts);
router.get("/:id", getContact);
router.post("/", createContact);
router.patch("/:id", updateContact);
router.delete("/:id", deleteContact);

export default router;

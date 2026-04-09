import { Router } from "express";

import {
  createIntern,
  disableGoogleAuthenticator,
  listUsers,
  login,
  me,
  register,
  setupGoogleAuthenticator,
  verifyGoogleAuthenticatorLogin,
  verifyGoogleAuthenticatorSetup,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/authz";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/2fa/verify-login", verifyGoogleAuthenticatorLogin);

router.get("/me", requireAuth, me);
router.get("/users", requireAuth, listUsers);
router.post("/interns", requireAuth, createIntern);
router.post("/2fa/setup", requireAuth, setupGoogleAuthenticator);
router.post("/2fa/verify-setup", requireAuth, verifyGoogleAuthenticatorSetup);
router.post("/2fa/disable", requireAuth, disableGoogleAuthenticator);

export default router;

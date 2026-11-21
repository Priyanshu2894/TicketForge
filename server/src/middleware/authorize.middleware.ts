import type { RequestHandler } from "express";
import type { PublicUser } from "../modules/auth/auth.service.js";

type Role = PublicUser["role"];

export function requireRole(
  ...allowedRoles: Role[]
): RequestHandler {
  return (req, res, next) => {
    const user = req.authUser;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
      return;
    }

    next();
  };
}
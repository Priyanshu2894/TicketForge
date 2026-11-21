import type { RequestHandler } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { verifyAccessToken } from "../modules/auth/auth.service.js";
import type { PublicUser } from "../modules/auth/auth.service.js";

export const authenticate: RequestHandler = async (
  req,
  res,
  next
) => {
  const authorization = req.headers.authorization;

  const [scheme, token, extra] =
    (authorization ?? "").split(" ");

  if (scheme !== "Bearer" || !token || extra) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  let userId: string;

  try {
    const payload = verifyAccessToken(token);

    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      !z.uuid().safeParse(payload.sub).success
    ) {
      throw new Error("Invalid token subject");
    }

    userId = payload.sub;
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired access token",
    });
    return;
  }

  const result = await pool.query<PublicUser>(
    `SELECT id, name, email, role
     FROM users
     WHERE id = $1`,
    [userId]
  );

  const user = result.rows[0];

  if (!user) {
    res.status(401).json({
      success: false,
      message: "Account no longer exists",
    });
    return;
  }

  req.authUser = user;
  next();
};
import type { Request, Response } from "express";

import {
  registerSchema,
  loginSchema,
} from "./auth.schema.js";

import {
  registerCustomer,
  loginCustomer,
  createAccessToken,
} from "./auth.service.js";

export async function register(
  req: Request,
  res: Response
) {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid registration data",
    });
    return;
  }

  try {
    const user = await registerCustomer(parsed.data);

    res.status(201).json({
      success: true,
      message: "Customer registered successfully",
      data: { user },
    });
  } catch (error) {
    // PostgreSQL unique constraint violation
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({
        success: false,
        message: "Email already registered",
      });
      return;
    }

    throw error;
  }
}

export async function login(
  req: Request,
  res: Response
) {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid login data",
    });
    return;
  }

  const user = await loginCustomer(parsed.data);

  if (!user) {
    res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
    return;
  }

  const accessToken = createAccessToken(user.id);

  res.status(200).json({
    success: true,
    data: {
      user,
      accessToken,
      tokenType: "Bearer",
      expiresInSeconds: 900,
    },
  });
}

export function getMe(
  req: Request,
  res: Response
) {
  res.status(200).json({
    success: true,
    data: {
      user: req.authUser,
    },
  });
}
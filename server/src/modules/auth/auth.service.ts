
import "dotenv/config";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

import { pool } from "../../db/pool.js";

import type {
  RegisterInput,
  LoginInput,
} from "./auth.schema.js";

// Public user information (never expose password_hash)
export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
};

type UserWithPassword = PublicUser & {
  password_hash: string;
};

// Validate JWT secret and ensure TypeScript knows it's a string
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error(
      "JWT_SECRET must be at least 32 bytes"
    );
  }

  return secret;
}

const jwtSecret: string = getJwtSecret();

// Register a new customer
export async function registerCustomer(
  input: RegisterInput
): Promise<PublicUser> {
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
  });

  const result = await pool.query<PublicUser>(
    `
    INSERT INTO users (
      name,
      email,
      password_hash,
      role
    )
    VALUES ($1, $2, $3, 'CUSTOMER')
    RETURNING id, name, email, role
    `,
    [input.name, input.email, passwordHash]
  );

  return result.rows[0]!;
}

// Verify login credentials
export async function loginCustomer(
  input: LoginInput
): Promise<PublicUser | null> {
  const result = await pool.query<UserWithPassword>(
    `
    SELECT
      id,
      name,
      email,
      role,
      password_hash
    FROM users
    WHERE email = $1
    `,
    [input.email]
  );

  const user = result.rows[0];

  if (!user) {
    return null;
  }

  const isPasswordValid = await argon2.verify(
    user.password_hash,
    input.password
  );

  if (!isPasswordValid) {
    return null;
  }

  const { password_hash: _passwordHash, ...publicUser } = user;

  return publicUser;
}

// Generate a short-lived JWT access token
export function createAccessToken(userId: string): string {
  return jwt.sign({}, jwtSecret, {
    subject: userId,
    expiresIn: 15 * 60,
    algorithm: "HS256",
    issuer: "ticketforge",
    audience: "ticketforge-api",
  });
}
export function verifyAccessToken(token: string) {
  return jwt.verify(token, jwtSecret, {
    algorithms: ["HS256"],
    issuer: "ticketforge",
    audience: "ticketforge-api",
  });
}
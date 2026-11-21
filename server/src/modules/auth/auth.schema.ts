import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(255));

export const registerSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: z.string().min(8).max(128),
});

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
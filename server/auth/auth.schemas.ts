import { z } from 'zod'

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),

  password: z.string().min(12).max(128),

  username: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username can only contain letters, numbers and underscores',
    ),

  name: z.string().trim().min(1).max(100).optional(),
})

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>

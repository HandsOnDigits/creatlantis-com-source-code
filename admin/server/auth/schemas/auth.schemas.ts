import { z } from 'zod'

export const adminLoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(1024),
})

export type AdminLoginInput = z.infer<typeof adminLoginSchema>

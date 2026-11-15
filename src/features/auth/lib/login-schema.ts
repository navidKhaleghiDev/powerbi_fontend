import { z } from 'zod';

export const createLoginSchema = (requiredMessage: string) =>
  z.object({
    username: z.string().trim().min(1, requiredMessage),
    password: z.string().min(1, requiredMessage),
  });

export type LoginValues = z.infer<ReturnType<typeof createLoginSchema>>;

import { z } from 'zod';

export const createCredentialsSchema = (requiredMessage: string) =>
  z.object({
    username: z.string().trim().min(1, requiredMessage),
    password: z.string().min(1, requiredMessage),
  });

export type CredentialsValues = z.infer<ReturnType<typeof createCredentialsSchema>>;

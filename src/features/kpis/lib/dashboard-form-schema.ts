import { z } from 'zod';

export const createDashboardFormSchema = (requiredMessage: string, invalidMessage: string) =>
  z.object({
    title: z.string().trim().min(1, requiredMessage).max(100, invalidMessage),
    description: z.string().trim(),
  });

export type DashboardFormValues = z.infer<ReturnType<typeof createDashboardFormSchema>>;

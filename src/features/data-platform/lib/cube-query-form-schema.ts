import { z } from 'zod';

export const createCubeQueryFormSchema = (validationMessage: string) =>
  z
    .object({
      filter: z.string(),
      limit: z.number().int().min(1).max(1000),
      time: z.string(),
      granularity: z.string().min(1),
      from: z.string(),
      to: z.string(),
    })
    .refine((values) => !values.time || Boolean(values.from) === Boolean(values.to), {
      path: ['from'],
      error: validationMessage,
    });

export type CubeQueryFormValues = z.infer<ReturnType<typeof createCubeQueryFormSchema>>;

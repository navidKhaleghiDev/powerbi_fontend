import { z } from 'zod';

export const createAnalyticsFilterSchema = (requiredMessage: string) =>
  z
    .object({
      from: z.iso.date({ error: requiredMessage }),
      to: z.iso.date({ error: requiredMessage }),
      calendar: z.enum(['persian', 'gregorian']),
      mode: z.enum(['latest', 'historical']),
      knownAt: z.string(),
      values: z.record(z.string(), z.string()),
    })
    .refine((values) => values.mode !== 'historical' || Boolean(values.knownAt), {
      path: ['knownAt'],
      error: requiredMessage,
    });

export type AnalyticsFilterValues = z.infer<ReturnType<typeof createAnalyticsFilterSchema>>;

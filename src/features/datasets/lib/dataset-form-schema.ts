import { z } from 'zod';

export const createDatasetFormSchema = (requiredMessage: string, invalidMessage: string) =>
  z.object({
    title: z.string().trim().min(1, requiredMessage).max(160, invalidMessage),
    slug: z
      .string()
      .trim()
      .min(1, requiredMessage)
      .max(50, invalidMessage)
      .regex(/^[a-zA-Z0-9_-]+$/, invalidMessage),
    grain: z.string().trim().min(1, requiredMessage).max(255, invalidMessage),
    description: z.string(),
    source: z.string().min(1, requiredMessage),
    primaryKey: z.string().min(1, requiredMessage),
    version: z.string(),
    deleted: z.string(),
    history: z.string(),
    recordedAt: z.string(),
    historyStart: z.string(),
    unit: z.string().trim().min(1, requiredMessage).max(24, invalidMessage),
    timezone: z.string().trim().min(1, requiredMessage),
  });

export type DatasetFormValues = z.infer<ReturnType<typeof createDatasetFormSchema>>;

export const createDatasetFieldsSchema = (requiredMessage: string, invalidMessage: string) =>
  z
    .array(
      z.object({
        name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, invalidMessage),
        column: z.string().min(1, requiredMessage),
        type: z.enum(['date', 'number', 'string']),
      }),
    )
    .min(1, requiredMessage);

export const createCustomMetricSchema = (requiredMessage: string) =>
  z.object({
    key: z.string().trim().min(1, requiredMessage),
    title: z.string().trim().min(1, requiredMessage),
    description: z.string().trim().min(1, requiredMessage),
  });

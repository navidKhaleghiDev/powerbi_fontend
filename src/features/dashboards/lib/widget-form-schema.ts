import { z } from 'zod';

export const createWidgetFormSchema = (requiredMessage: string, invalidMessage: string) =>
  z
    .object({
      measure: z.string().min(1, requiredMessage),
      dimension: z.string(),
      visual: z.enum(['card', 'bar', 'horizontalBar', 'line', 'pie', 'radar', 'heatmap', 'table']),
      title: z.string().max(160, invalidMessage),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/, invalidMessage),
      showValues: z.boolean(),
    })
    .refine(
      (values) =>
        values.visual === 'card' || values.visual === 'table' || Boolean(values.dimension),
      {
        path: ['dimension'],
        error: requiredMessage,
      },
    );

export type WidgetFormValues = z.infer<ReturnType<typeof createWidgetFormSchema>>;

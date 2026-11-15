import { z } from 'zod';

export const createConsumerFormSchema = (validationMessage: string) =>
  z.object({ topicPrefix: z.string().trim().min(1, validationMessage) });

export type ConsumerFormValues = z.infer<ReturnType<typeof createConsumerFormSchema>>;

export const createConsumerTablesSchema = (validationMessage: string) =>
  z
    .array(
      z.object({
        source_table: z.string().min(1, validationMessage),
        target_table: z.string().trim().min(1, validationMessage),
        columns: z
          .array(
            z.object({
              source: z.string().min(1, validationMessage),
              target: z.string().trim().min(1, validationMessage),
              type: z.string().trim().min(1, validationMessage),
            }),
          )
          .min(1, validationMessage),
        order_by: z.array(z.string()),
      }),
    )
    .min(1, validationMessage);

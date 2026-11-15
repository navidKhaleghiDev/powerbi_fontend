import { z } from 'zod';

import { MAX_QUESTION } from '@/features/assistant/lib/core';

export const createChatFormSchema = (requiredMessage: string, tooLongMessage: string) =>
  z.object({
    message: z.string().trim().min(1, requiredMessage).max(MAX_QUESTION, tooLongMessage),
  });

export type ChatFormValues = z.infer<ReturnType<typeof createChatFormSchema>>;

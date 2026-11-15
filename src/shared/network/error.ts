const fallbackMessage = (): string =>
  document.documentElement.lang === 'fa'
    ? 'خطای داخلی رخ داده است.'
    : 'Something went wrong. Please try again.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const messageFromValue = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    const messages = value
      .map(messageFromValue)
      .filter((message): message is string => Boolean(message));
    return messages.length ? messages.map((message) => `• ${message}`).join('\n') : null;
  }
  return null;
};

export const getApiErrorMessage = (error: unknown): string => {
  if (!isRecord(error)) return fallbackMessage();

  const response = isRecord(error.response) ? error.response : null;
  const data = response && isRecord(response.data) ? response.data : null;
  for (const value of [data?.error, data?.message, error.error, error.message]) {
    const message = messageFromValue(value);
    if (message) return message;
  }
  return fallbackMessage();
};

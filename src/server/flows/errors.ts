export class FlowError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(code);
  }
}
export const requireValue = <T>(
  value: T | null | undefined,
  code = "notFound",
): T => {
  if (value === undefined || value === null) throw new FlowError(code, 404);
  return value;
};

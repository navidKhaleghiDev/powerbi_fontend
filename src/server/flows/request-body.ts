import { FlowError } from "./errors";
export const readJsonBody = async (
  request: Request,
  limit = 6 * 1024 * 1024,
  limitCode = "csvLimit",
): Promise<unknown> => {
  const reader = request.body?.getReader();
  if (!reader) throw new FlowError("invalid");
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new FlowError(limitCode, 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new FlowError("invalid");
  }
};

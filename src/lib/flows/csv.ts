import type { CsvPreview } from './types';

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_ROWS = 5000;
/** RFC4180-style quoted fields, escaped quotes, CRLF and embedded newlines. */
export const parseCsv = (input: string): CsvPreview => {
  if (new TextEncoder().encode(input).length > MAX_CSV_BYTES) throw new Error('csvLimit');
  const text = input.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (closed && c !== ',' && c !== '\r' && c !== '\n') throw new Error('csvInvalid');
    if (c === '"') {
      if (field) throw new Error('csvInvalid');
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
      closed = false;
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((value) => value !== '')) records.push(row);
      row = [];
      field = '';
      closed = false;
      if (records.length > MAX_CSV_ROWS + 1) throw new Error('csvLimit');
    } else field += c;
  }
  if (quoted) throw new Error('csvInvalid');
  if (field || row.length || closed) {
    row.push(field);
    records.push(row);
  }
  const columns = records.shift()?.map((value) => value.trim()) ?? [];
  if (
    !columns.length ||
    columns.length > 100 ||
    columns.some((value) => !value) ||
    new Set(columns).size !== columns.length ||
    !records.length
  )
    throw new Error('csvInvalid');
  if (records.length > MAX_CSV_ROWS || records.some((values) => values.length !== columns.length))
    throw new Error('csvInvalid');
  return {
    columns,
    rows: records.map((values) => Object.fromEntries(columns.map((name, i) => [name, values[i]]))),
    rowCount: records.length,
  };
};

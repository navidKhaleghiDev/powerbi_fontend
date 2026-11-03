import { describe, expect, it } from "vitest";

import { parseCsv } from "../csv";
import { formatExactValue } from "../display";
describe("CSV contract", () => {
  it("handles BOM, CRLF, escaped quotes, commas and multiline fields", () => {
    expect(parseCsv('\uFEFFid,name\r\n1,"A, B"\r\n2,"a""b\nc"\r\n')).toEqual({
      columns: ["id", "name"],
      rows: [
        { id: "1", name: "A, B" },
        { id: "2", name: 'a"b\nc' },
      ],
      rowCount: 2,
    });
  });
  it.each([
    "id,id\n1,2",
    "id,name\n1",
    'id,name\n1,"broken',
    'id,name\n1,"a"x',
    'id,name\n1,a"b',
    "id,name\n",
  ])("rejects invalid CSV %s", (value) =>
    expect(() => parseCsv(value)).toThrow(),
  );
  it("rejects oversized files", () =>
    expect(() => parseCsv("id\n" + "x".repeat(2 * 1024 * 1024))).toThrow(
      "csvLimit",
    ));
  it("preserves exact decimal text", () =>
    expect(parseCsv("id,money\n1,1234567890123456.12").rows[0].money).toBe(
      "1234567890123456.12",
    ));
});

describe("precise KPI display", () => {
  it("does not round large decimal amounts through Number", () =>
    expect(formatExactValue("1234567890123456.12", "en")).toBe(
      "1,234,567,890,123,456.12",
    ));
  it("retains negative sub-unit amounts", () =>
    expect(formatExactValue("-0.25", "en")).toBe("-0.25"));
});

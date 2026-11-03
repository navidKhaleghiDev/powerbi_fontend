import { describe, expect, it } from "vitest";

import { schemaDiscovery } from "../schemaDiscovery";
import type { SchemaField, SchemaVersion } from "../types";

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const makeField = (
  name: string,
  overrides: Partial<SchemaField> = {},
): SchemaField => ({
  name,
  sourceType: "TEXT",
  nullable: false,
  pii: false,
  classification: "unknown",
  ...overrides,
});

const makeVersion = (
  fields: SchemaField[],
  fingerprint = "fp_test",
): SchemaVersion => ({
  versionId: "v1",
  datasetId: "ds-1",
  fingerprint,
  fields,
});

/* ---------------------------------------------------------------------------
 * Phase ordering tests
 * ------------------------------------------------------------------------- */

describe("schemaDiscovery — phase ordering", () => {
  it("exposes all six phases in order", () => {
    expect(schemaDiscovery.PHASE_ORDER).toEqual([
      "discover",
      "profile",
      "classify",
      "version",
      "review",
      "propose",
    ]);
  });

  it("returns the next phase", () => {
    expect(schemaDiscovery.nextPhase("discover")).toBe("profile");
    expect(schemaDiscovery.nextPhase("profile")).toBe("classify");
    expect(schemaDiscovery.nextPhase("classify")).toBe("version");
    expect(schemaDiscovery.nextPhase("version")).toBe("review");
    expect(schemaDiscovery.nextPhase("review")).toBe("propose");
  });

  it("returns null after the last phase", () => {
    expect(schemaDiscovery.nextPhase("propose")).toBeNull();
  });
});

/* ---------------------------------------------------------------------------
 * Classification tests
 * ------------------------------------------------------------------------- */

describe("schemaDiscovery — classifyField", () => {
  it("classifies email as PII", () => {
    const result = schemaDiscovery.classifyField(
      makeField("customer_email"),
    );
    expect(result.classification).toBe("pii");
    expect(result.pii).toBe(true);
  });

  it("classifies phone as PII", () => {
    expect(
      schemaDiscovery.classifyField(makeField("phone_number")).classification,
    ).toBe("pii");
  });

  it("classifies amount fields as money", () => {
    expect(
      schemaDiscovery.classifyField(makeField("total_amount")).classification,
    ).toBe("money");
  });

  it("classifies timestamp fields correctly", () => {
    expect(
      schemaDiscovery.classifyField(makeField("created_at")).classification,
    ).toBe("timestamp");
  });

  it("classifies non-null id fields as identifier", () => {
    expect(
      schemaDiscovery.classifyField(
        makeField("order_id", { sourceType: "UUID" }),
      ).classification,
    ).toBe("identifier");
  });

  it("classifies dimension-like fields", () => {
    expect(
      schemaDiscovery.classifyField(makeField("category_name")).classification,
    ).toBe("dimension");
  });

  it("preserves explicit PII flag", () => {
    const result = schemaDiscovery.classifyField(
      makeField("notes", { pii: true }),
    );
    expect(result.pii).toBe(true);
  });
});

/* ---------------------------------------------------------------------------
 * Fingerprint tests
 * ------------------------------------------------------------------------- */

describe("schemaDiscovery — computeFingerprint", () => {
  it("produces the same fingerprint for identical schemas", () => {
    const fields = [
      makeField("id", { sourceType: "UUID" }),
      makeField("name", { sourceType: "TEXT" }),
    ];
    expect(schemaDiscovery.computeFingerprint(fields)).toBe(
      schemaDiscovery.computeFingerprint(fields),
    );
  });

  it("produces different fingerprints when a field type changes", () => {
    const v1 = [
      makeField("id", { sourceType: "UUID" }),
      makeField("amount", { sourceType: "DECIMAL" }),
    ];
    const v2 = [
      makeField("id", { sourceType: "UUID" }),
      makeField("amount", { sourceType: "FLOAT8" }),
    ];
    expect(schemaDiscovery.computeFingerprint(v1)).not.toBe(
      schemaDiscovery.computeFingerprint(v2),
    );
  });

  it("produces different fingerprints when nullability changes", () => {
    const v1 = [makeField("notes", { nullable: false })];
    const v2 = [makeField("notes", { nullable: true })];
    expect(schemaDiscovery.computeFingerprint(v1)).not.toBe(
      schemaDiscovery.computeFingerprint(v2),
    );
  });

  it("is order-independent", () => {
    const a = [
      makeField("id", { sourceType: "UUID" }),
      makeField("name", { sourceType: "TEXT" }),
    ];
    const b = [
      makeField("name", { sourceType: "TEXT" }),
      makeField("id", { sourceType: "UUID" }),
    ];
    expect(schemaDiscovery.computeFingerprint(a)).toBe(
      schemaDiscovery.computeFingerprint(b),
    );
  });
});

/* ---------------------------------------------------------------------------
 * Schema diff tests
 * ------------------------------------------------------------------------- */

describe("schemaDiscovery — diffSchemas", () => {
  const previous = makeVersion([
    makeField("id", { sourceType: "UUID" }),
    makeField("amount", { sourceType: "DECIMAL" }),
    makeField("name", { sourceType: "TEXT" }),
  ]);

  it("detects added fields", () => {
    const current = [
      makeField("id", { sourceType: "UUID" }),
      makeField("amount", { sourceType: "DECIMAL" }),
      makeField("name", { sourceType: "TEXT" }),
      makeField("notes", { sourceType: "TEXT" }),
    ];
    const diff = schemaDiscovery.diffSchemas(previous, current);
    expect(diff.added).toEqual(["notes"]);
    expect(diff.removed).toEqual([]);
  });

  it("detects removed fields", () => {
    const current = [
      makeField("id", { sourceType: "UUID" }),
      makeField("name", { sourceType: "TEXT" }),
    ];
    const diff = schemaDiscovery.diffSchemas(previous, current);
    expect(diff.removed).toEqual(["amount"]);
  });

  it("detects type changes", () => {
    const current = [
      makeField("id", { sourceType: "UUID" }),
      makeField("amount", { sourceType: "FLOAT8" }), // changed from DECIMAL
      makeField("name", { sourceType: "TEXT" }),
    ];
    const diff = schemaDiscovery.diffSchemas(previous, current);
    expect(diff.typeChanged).toEqual(["amount"]);
  });

  it("detects nullability changes", () => {
    const current = [
      makeField("id", { sourceType: "UUID" }),
      makeField("amount", { sourceType: "DECIMAL" }),
      makeField("name", { sourceType: "TEXT", nullable: true }), // was false
    ];
    const diff = schemaDiscovery.diffSchemas(previous, current);
    expect(diff.nullabilityChanged).toEqual(["name"]);
  });
});

describe("schemaDiscovery — isBreakingChange", () => {
  it("field removal is breaking", () => {
    expect(
      schemaDiscovery.isBreakingChange({
        added: [],
        removed: ["amount"],
        typeChanged: [],
        nullabilityChanged: [],
      }),
    ).toBe(true);
  });

  it("type change is breaking", () => {
    expect(
      schemaDiscovery.isBreakingChange({
        added: [],
        removed: [],
        typeChanged: ["amount"],
        nullabilityChanged: [],
      }),
    ).toBe(true);
  });

  it("only-nullability-change is not breaking", () => {
    expect(
      schemaDiscovery.isBreakingChange({
        added: [],
        removed: [],
        typeChanged: [],
        nullabilityChanged: ["notes"],
      }),
    ).toBe(false);
  });

  it("only-added is not breaking", () => {
    expect(
      schemaDiscovery.isBreakingChange({
        added: ["notes"],
        removed: [],
        typeChanged: [],
        nullabilityChanged: [],
      }),
    ).toBe(false);
  });
});

/* ---------------------------------------------------------------------------
 * Full pipeline tests
 * ------------------------------------------------------------------------- */

describe("schemaDiscovery — runFullPipeline", () => {
  it("runs all six phases and returns a fingerprint", () => {
    const result = schemaDiscovery.runFullPipeline(
      "ds-1",
      [
        { name: "id", type: "UUID", nullable: false },
        { name: "amount", type: "DECIMAL(18,2)", nullable: false },
        { name: "created_at", type: "TIMESTAMPTZ", nullable: false },
        { name: "email", type: "TEXT", nullable: true },
      ],
      [
        { fieldName: "id", nullCount: 0, uniqueCount: 1000 },
        { fieldName: "amount", nullCount: 0, uniqueCount: 800 },
        { fieldName: "created_at", nullCount: 0, uniqueCount: 1000 },
        { fieldName: "email", nullCount: 50, uniqueCount: 950 },
      ],
    );

    expect(result.phases).toHaveLength(6);
    expect(result.phases[0].phase).toBe("discover");
    expect(result.phases[5].phase).toBe("propose");
    expect(result.fingerprint).toMatch(/^fp_/);
    expect(result.fields).toHaveLength(4);

    // email should be classified as PII
    const emailField = result.fields.find((f) => f.name === "email");
    expect(emailField?.pii).toBe(true);
    expect(emailField?.classification).toBe("pii");
  });
});

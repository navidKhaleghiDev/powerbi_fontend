import { describe, expect, it } from "vitest";

import { validation } from "../validation";
import type {
  CurrentRowIdentity,
  SourceChange,
} from "../types";

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const makeIdentity = (
  pk: string,
  overrides: Partial<CurrentRowIdentity> = {},
): CurrentRowIdentity => ({
  organizationId: "org-1",
  sourceId: "src-1",
  datasetId: "ds-1",
  sourcePrimaryKey: pk,
  ...overrides,
});

const makeChange = (
  pk: string,
  version: number,
  operation: SourceChange["operation"] = "update",
  overrides: Partial<SourceChange> = {},
): SourceChange => ({
  identity: makeIdentity(pk),
  event: {
    sourcePartition: "p0",
    logPosition: version,
    eventIndex: 0,
  },
  operation,
  payload: { value: version },
  sourceVersion: version,
  ...overrides,
});

/* ---------------------------------------------------------------------------
 * Identity tests
 * ------------------------------------------------------------------------- */

describe("validation — identityKey", () => {
  it("produces the same key for identical identities", () => {
    const a = makeIdentity("row-1");
    const b = makeIdentity("row-1");
    expect(validation.identityKey(a)).toBe(validation.identityKey(b));
  });

  it("produces different keys for different organizations", () => {
    const a = makeIdentity("row-1", { organizationId: "org-1" });
    const b = makeIdentity("row-1", { organizationId: "org-2" });
    expect(validation.identityKey(a)).not.toBe(validation.identityKey(b));
  });

  it("produces different keys for different datasets", () => {
    const a = makeIdentity("row-1", { datasetId: "ds-1" });
    const b = makeIdentity("row-1", { datasetId: "ds-2" });
    expect(validation.identityKey(a)).not.toBe(validation.identityKey(b));
  });

  it("produces different keys for different sources", () => {
    const a = makeIdentity("row-1", { sourceId: "src-1" });
    const b = makeIdentity("row-1", { sourceId: "src-2" });
    expect(validation.identityKey(a)).not.toBe(validation.identityKey(b));
  });

  it("produces different keys for different primary keys", () => {
    expect(validation.identityKey(makeIdentity("row-1"))).not.toBe(
      validation.identityKey(makeIdentity("row-2")),
    );
  });
});

describe("validation — sameRow", () => {
  it("returns true for identical identities", () => {
    expect(validation.sameRow(makeIdentity("row-1"), makeIdentity("row-1"))).toBe(true);
  });

  it("returns false when only the PK matches but org differs", () => {
    expect(
      validation.sameRow(
        makeIdentity("row-1", { organizationId: "org-1" }),
        makeIdentity("row-1", { organizationId: "org-2" }),
      ),
    ).toBe(false);
  });
});

/* ---------------------------------------------------------------------------
 * Idempotent merge tests
 * ------------------------------------------------------------------------- */

describe("validation — mergeRecords (version-aware merge)", () => {
  it("produces one current-state row for duplicate PKs", () => {
    const changes = [
      makeChange("row-1", 10, "insert"),
      makeChange("row-1", 20, "update"),
      makeChange("row-1", 30, "update"),
    ];
    const merged = validation.mergeRecords(changes);
    expect(merged.size).toBe(1);
  });

  it("keeps the highest version when events arrive out of order", () => {
    const changes = [
      makeChange("row-1", 30, "insert"),
      makeChange("row-1", 10, "insert"),
      makeChange("row-1", 20, "delete"),
    ];
    const merged = validation.mergeRecords(changes);
    const key = validation.identityKey(makeIdentity("row-1"));
    const final = merged.get(key);
    expect(final?.sourceVersion).toBe(30);
    expect(final?.operation).toBe("insert");
  });

  it("produces a delete (tombstone) when the last event is a delete", () => {
    const changes = [
      makeChange("row-1", 10, "insert"),
      makeChange("row-1", 20, "update"),
      makeChange("row-1", 30, "delete"),
    ];
    const merged = validation.mergeRecords(changes);
    const final = merged.get(validation.identityKey(makeIdentity("row-1")));
    expect(final?.operation).toBe("delete");
  });

  it("resolves delete-then-reinsert to insert", () => {
    const changes = [
      makeChange("row-1", 10, "insert"),
      makeChange("row-1", 20, "delete"),
      makeChange("row-1", 30, "insert"),
    ];
    const final = validation.resolveFinalOperation(changes);
    expect(final?.operation).toBe("insert");
    expect(final?.sourceVersion).toBe(30);
  });

  it("is idempotent: replaying the exact same event does not change state", () => {
    const change = makeChange("row-1", 10, "insert");
    const first = validation.mergeRecords([change]);
    const second = validation.mergeRecords([change, change]);
    expect(second.size).toBe(first.size);
  });

  it("keeps separate rows for different PKs", () => {
    const changes = [
      makeChange("row-1", 10, "insert"),
      makeChange("row-2", 10, "insert"),
      makeChange("row-3", 10, "insert"),
    ];
    const merged = validation.mergeRecords(changes);
    expect(merged.size).toBe(3);
  });

  it("keeps separate rows for same PK across different orgs", () => {
    const changes = [
      makeChange("row-1", 10, "insert"),
      {
        ...makeChange("row-1", 10, "insert"),
        identity: makeIdentity("row-1", { organizationId: "org-2" }),
      },
    ];
    const merged = validation.mergeRecords(changes);
    expect(merged.size).toBe(2);
  });
});

describe("validation — applyBatchIdempotent", () => {
  it("does not create duplicates when applying the same batch twice", () => {
    const incoming = [makeChange("row-1", 100, "update")];
    const existing = new Map<string, SourceChange>([
      [validation.identityKey(makeIdentity("row-1")), makeChange("row-1", 100, "update")],
    ]);

    const result = validation.applyBatchIdempotent(existing, incoming);
    expect(result.size).toBe(existing.size);
  });

  it("applies newer versions and updates the existing row", () => {
    const existing = new Map<string, SourceChange>([
      [validation.identityKey(makeIdentity("row-1")), makeChange("row-1", 50, "update")],
    ]);
    const incoming = [makeChange("row-1", 100, "update")];

    const result = validation.applyBatchIdempotent(existing, incoming);
    const final = result.get(validation.identityKey(makeIdentity("row-1")));
    expect(final?.sourceVersion).toBe(100);
  });

  it("ignores stale (lower-version) incoming changes", () => {
    const existing = new Map<string, SourceChange>([
      [validation.identityKey(makeIdentity("row-1")), makeChange("row-1", 100, "update")],
    ]);
    const incoming = [makeChange("row-1", 50, "update")];

    const result = validation.applyBatchIdempotent(existing, incoming);
    const final = result.get(validation.identityKey(makeIdentity("row-1")));
    expect(final?.sourceVersion).toBe(100);
  });
});

describe("validation — countDistinctRows", () => {
  it("counts unique row identities", () => {
    const changes = [
      makeChange("row-1", 10, "insert"),
      makeChange("row-1", 20, "update"),
      makeChange("row-2", 10, "insert"),
    ];
    expect(validation.countDistinctRows(changes)).toBe(2);
  });
});

describe("validation — endsInDelete", () => {
  it("returns true when the highest-version event is a delete", () => {
    expect(
      validation.endsInDelete([
        makeChange("row-1", 10, "insert"),
        makeChange("row-1", 20, "delete"),
      ]),
    ).toBe(true);
  });

  it("returns false when a re-insert follows a delete", () => {
    expect(
      validation.endsInDelete([
        makeChange("row-1", 10, "insert"),
        makeChange("row-1", 20, "delete"),
        makeChange("row-1", 30, "insert"),
      ]),
    ).toBe(false);
  });
});

/* ---------------------------------------------------------------------------
 * Schema validation tests
 * ------------------------------------------------------------------------- */

describe("validation — validateSchema", () => {
  it("accepts a clean schema with no issues", () => {
    const outcome = validation.validateSchema(
      [
        {
          fieldName: "id",
          sourceType: "UUID",
          declaredType: "UUID",
          nullable: false,
        },
        {
          fieldName: "amount",
          sourceType: "DECIMAL(18,2)",
          declaredType: "DECIMAL(18,2)",
          nullable: false,
        },
      ],
      {},
    );
    expect(outcome.status).toBe("accept");
  });

  it("quarantines floating-point currency fields", () => {
    const outcome = validation.validateSchema(
      [
        {
          fieldName: "amount",
          sourceType: "FLOAT8",
          declaredType: "DECIMAL(18,2)",
          nullable: false,
        },
      ],
      {},
    );
    expect(outcome.status).toBe("quarantine");
    expect(outcome.status === "quarantine" && outcome.issues).toHaveLength(1);
    expect(outcome.status === "quarantine" && outcome.issues[0].type).toBe(
      "currency-rounding",
    );
  });

  it("quarantines timestamps without timezone", () => {
    const outcome = validation.validateSchema(
      [
        {
          fieldName: "created_at",
          sourceType: "TIMESTAMP",
          declaredType: "TIMESTAMP",
          nullable: false,
        },
      ],
      {},
    );
    expect(outcome.status).toBe("quarantine");
  });

  it("blocks when a field is removed", () => {
    const outcome = validation.validateSchema(
      [
        {
          fieldName: "amount",
          sourceType: "REMOVED",
          declaredType: "DECIMAL(18,2)",
          nullable: false,
        },
      ],
      {},
    );
    expect(outcome.status).toBe("block");
  });

  it("flags new nullable fields as quarantine", () => {
    const outcome = validation.validateSchema(
      [
        {
          fieldName: "notes",
          sourceType: "TEXT",
          declaredType: "TEXT",
          nullable: true,
        },
      ],
      { notes: false }, // was NOT NULL before
    );
    expect(outcome.status).toBe("quarantine");
  });
});

/* ---------------------------------------------------------------------------
 * Backoff / retry tests
 * ------------------------------------------------------------------------- */

describe("validation — shouldRetry", () => {
  it("retries on 429", () => {
    expect(validation.shouldRetry(429, 1)).toBe(true);
  });

  it("retries on 5xx errors", () => {
    expect(validation.shouldRetry(500, 1)).toBe(true);
    expect(validation.shouldRetry(503, 1)).toBe(true);
  });

  it("does not retry on 4xx (except 429)", () => {
    expect(validation.shouldRetry(400, 1)).toBe(false);
    expect(validation.shouldRetry(404, 1)).toBe(false);
  });

  it("retries on network errors (undefined status)", () => {
    expect(validation.shouldRetry(undefined, 1)).toBe(true);
  });

  it("stops retrying after max attempts", () => {
    const config = { ...validation.DEFAULT_RETRY_CONFIG, maxAttempts: 3 };
    expect(validation.shouldRetry(429, 3, config)).toBe(false);
    expect(validation.shouldRetry(429, 2, config)).toBe(true);
  });
});

describe("validation — computeBackoffDelay", () => {
  it("produces a delay within the jitter range [50%, 100%] of the exponential", () => {
    const delay = validation.computeBackoffDelay(2, {
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 30_000,
    });
    // attempt 2: exponential = 1000 * 2^1 = 2000, jitter 0.5-1.0 → 1000-2000
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(2000);
  });

  it("caps the delay at maxDelayMs", () => {
    const delay = validation.computeBackoffDelay(10, {
      maxAttempts: 20,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
    });
    // attempt 10: exponential = 1000 * 2^9 = 512000, capped at 5000
    // with jitter: 2500-5000
    expect(delay).toBeLessThanOrEqual(5000);
  });
});

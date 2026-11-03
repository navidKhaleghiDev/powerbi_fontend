import { describe, expect, it } from "vitest";

import { batchStateMachine } from "../stateMachine";
import type {
  BatchStatus,
  Checkpoint,
  IngestionBatch,
  QualityResult,
  SyncRun,
} from "../types";

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const makeBatch = (
  overrides: Partial<IngestionBatch> = {},
): IngestionBatch => ({
  batchId: "b1",
  runId: "r1",
  manifestUri: "s3://raw/b1.json",
  rowCount: 100,
  status: "extracted",
  sourceCursor: "c100",
  ...overrides,
});

const makeCheckpoint = (
  overrides: Partial<Checkpoint> = {},
): Checkpoint => ({
  checkpointId: "cp1",
  policyId: "p1",
  committedCursor: "c50",
  cursorFormat: "updated_at-pk",
  ...overrides,
});

const makeRun = (overrides: Partial<SyncRun> = {}): SyncRun => ({
  runId: "r1",
  policyId: "p1",
  status: "running",
  attempt: 1,
  startedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const acceptQuality: QualityResult = {
  qualityId: "q1",
  batchId: "b1",
  verdict: "accept",
  rulesetVersion: "v1",
  failures: {},
};

/* ---------------------------------------------------------------------------
 * Tests
 * ------------------------------------------------------------------------- */

describe("batchStateMachine — ordering", () => {
  it("exposes the five statuses in correct order", () => {
    expect(batchStateMachine.ORDER).toEqual([
      "extracted",
      "uploaded",
      "verified",
      "applied",
      "published",
    ]);
  });

  it("only allows forward transitions of exactly one step", () => {
    expect(
      batchStateMachine.isValidForwardTransition("extracted", "uploaded"),
    ).toBe(true);
    expect(
      batchStateMachine.isValidForwardTransition("uploaded", "verified"),
    ).toBe(true);
    expect(
      batchStateMachine.isValidForwardTransition("verified", "applied"),
    ).toBe(true);
    expect(
      batchStateMachine.isValidForwardTransition("applied", "published"),
    ).toBe(true);
  });

  it("rejects skipping steps", () => {
    expect(
      batchStateMachine.isValidForwardTransition("extracted", "verified"),
    ).toBe(false);
    expect(
      batchStateMachine.isValidForwardTransition("extracted", "published"),
    ).toBe(false);
  });

  it("rejects backwards transitions", () => {
    expect(
      batchStateMachine.isValidForwardTransition("verified", "uploaded"),
    ).toBe(false);
    expect(
      batchStateMachine.isValidForwardTransition("published", "applied"),
    ).toBe(false);
  });

  it("rejects self-transitions", () => {
    expect(
      batchStateMachine.isValidForwardTransition("extracted", "extracted"),
    ).toBe(false);
  });
});

describe("batchStateMachine — transition", () => {
  it("advances a batch by one status", () => {
    const batch = makeBatch();
    const result = batchStateMachine.transition(batch, "uploaded");
    expect(result.status).toBe("uploaded");
  });

  it("returns a new object (immutable)", () => {
    const batch = makeBatch();
    const result = batchStateMachine.transition(batch, "uploaded");
    expect(result).not.toBe(batch);
    expect(batch.status).toBe("extracted");
  });

  it("throws on invalid transition (skipping)", () => {
    const batch = makeBatch({ status: "extracted" });
    expect(() =>
      batchStateMachine.transition(batch, "verified"),
    ).toThrow(/Invalid transition/);
  });

  it("throws on invalid transition (backwards)", () => {
    const batch = makeBatch({ status: "verified" });
    expect(() =>
      batchStateMachine.transition(batch, "uploaded"),
    ).toThrow(/Invalid transition/);
  });

  it("throws when transitioning from terminal state", () => {
    const batch = makeBatch({ status: "published" });
    expect(() => batchStateMachine.transition(batch, "published")).toThrow(
      /terminal/,
    );
  });
});

describe("batchStateMachine — isTerminal", () => {
  it("published is terminal", () => {
    expect(batchStateMachine.isTerminal("published")).toBe(true);
  });

  it("all other statuses are not terminal", () => {
    const nonTerminal: BatchStatus[] = [
      "extracted",
      "uploaded",
      "verified",
      "applied",
    ];
    nonTerminal.forEach((s) => {
      expect(batchStateMachine.isTerminal(s)).toBe(false);
    });
  });
});

describe("batchStateMachine — applyAndCommit (atomic commit)", () => {
  it("advances both batch and checkpoint atomically", () => {
    const batch = makeBatch({ status: "verified", sourceCursor: "c100" });
    const checkpoint = makeCheckpoint({ committedCursor: "c50" });
    const run = makeRun();

    const [newBatch, newCheckpoint, newRun] = batchStateMachine.applyAndCommit(
      batch,
      checkpoint,
      run,
      acceptQuality,
    );

    expect(newBatch.status).toBe("applied");
    // Checkpoint advances to the batch's extraction cursor
    expect(newCheckpoint.committedCursor).toBe("c100");
    expect(newRun.status).toBe("running");
  });

  it("throws if batch is not at VERIFIED status", () => {
    const batch = makeBatch({ status: "uploaded" });
    expect(() =>
      batchStateMachine.applyAndCommit(
        batch,
        makeCheckpoint(),
        makeRun(),
        acceptQuality,
      ),
    ).toThrow(/expected status "verified"/);
  });

  it("throws if quality result rejected the batch", () => {
    const batch = makeBatch({ status: "verified" });
    const rejectQuality: QualityResult = {
      ...acceptQuality,
      verdict: "reject",
    };
    expect(() =>
      batchStateMachine.applyAndCommit(
        batch,
        makeCheckpoint(),
        makeRun(),
        rejectQuality,
      ),
    ).toThrow(/quality result was "reject"/);
  });

  it("does NOT advance the checkpoint before APPLY", () => {
    // A batch uploaded but not yet applied must leave the checkpoint unchanged.
    const batch = makeBatch({ status: "extracted", sourceCursor: "c100" });
    const checkpoint = makeCheckpoint({ committedCursor: "c50" });
    const uploaded = batchStateMachine.transition(batch, "uploaded");
    // Checkpoint is still at c50
    expect(checkpoint.committedCursor).toBe("c50");
    expect(uploaded.status).toBe("uploaded");
  });
});

describe("batchStateMachine — publish", () => {
  it("publishes an applied batch", () => {
    const batch = makeBatch({ status: "applied" });
    const result = batchStateMachine.publish(batch);
    expect(result.status).toBe("published");
  });

  it("throws if batch is not at APPLIED", () => {
    const batch = makeBatch({ status: "verified" });
    expect(() => batchStateMachine.publish(batch)).toThrow(
      /expected status "applied"/,
    );
  });
});

describe("batchStateMachine — recover", () => {
  it("replays from current durable status for non-applied batches", () => {
    const batch = makeBatch({ status: "uploaded" });
    const checkpoint = makeCheckpoint({ committedCursor: "c50" });
    const { batch: recovered, replayFrom } = batchStateMachine.recover(
      batch,
      checkpoint,
    );
    expect(replayFrom).toBe("uploaded");
    expect(recovered.status).toBe("uploaded");
  });

  it("allows APPLIED batches to proceed to PUBLISHED on recovery", () => {
    const batch = makeBatch({ status: "applied" });
    const { replayFrom } = batchStateMachine.recover(
      batch,
      makeCheckpoint(),
    );
    expect(replayFrom).toBe("applied");
  });
});

describe("batchStateMachine — runPipeline (happy path)", () => {
  it("runs a batch from EXTRACTED all the way to PUBLISHED", () => {
    const batch = makeBatch({ status: "extracted", sourceCursor: "c100" });
    const checkpoint = makeCheckpoint({ committedCursor: "c50" });
    const run = makeRun();

    const result = batchStateMachine.runPipeline(
      batch,
      checkpoint,
      run,
      acceptQuality,
    );

    expect(result.batch.status).toBe("published");
    expect(result.checkpoint.committedCursor).toBe("c100");
    expect(result.run.status).toBe("succeeded");
  });
});

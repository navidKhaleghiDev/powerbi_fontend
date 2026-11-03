import { describe, expect, it } from "vitest";

import { dataPlatformApi } from "../mockData";
import { organization } from "../organization";

describe("single organization workspace", () => {
  it("returns exactly one organization object", async () => {
    const result = await dataPlatformApi.getOrganization();
    expect(Array.isArray(result)).toBe(false);
    expect(result).toEqual(organization);
  });

  it("preserves every source and scopes it to the workspace organization", async () => {
    const connections = await dataPlatformApi.getConnections();
    expect(connections.map((connection) => connection.connectionId)).toEqual([
      "conn-1",
      "conn-2",
      "conn-3",
      "conn-4",
    ]);
    expect(
      new Set(connections.map((connection) => connection.organizationId)),
    ).toEqual(new Set([organization.organizationId]));
  });

  it("keeps datasets, policies, and batches linked to existing workspace records", async () => {
    const [
      connections,
      datasets,
      policies,
      runs,
      batches,
      checkpoints,
      quality,
      schemas,
    ] = await Promise.all([
      dataPlatformApi.getConnections(),
      dataPlatformApi.getDatasets(),
      dataPlatformApi.getSyncPolicies(),
      dataPlatformApi.getSyncRuns(),
      dataPlatformApi.getIngestionBatches(),
      dataPlatformApi.getCheckpoints(),
      dataPlatformApi.getQualityResults(),
      dataPlatformApi.getSchemaVersions(),
    ]);
    expect(datasets).toHaveLength(5);
    for (const dataset of datasets)
      expect(
        connections.some((item) => item.connectionId === dataset.sourceId),
      ).toBe(true);
    for (const policy of policies)
      expect(datasets.some((item) => item.datasetId === policy.datasetId)).toBe(
        true,
      );
    for (const run of runs)
      expect(policies.some((item) => item.policyId === run.policyId)).toBe(
        true,
      );
    for (const batch of batches)
      expect(runs.some((item) => item.runId === batch.runId)).toBe(true);
    for (const checkpoint of checkpoints)
      expect(
        policies.some((item) => item.policyId === checkpoint.policyId),
      ).toBe(true);
    for (const result of quality)
      expect(batches.some((item) => item.batchId === result.batchId)).toBe(
        true,
      );
    for (const schema of schemas)
      expect(datasets.some((item) => item.datasetId === schema.datasetId)).toBe(
        true,
      );
  });

  it("retains organization-scoped warehouse identities", async () => {
    const [records, connections] = await Promise.all([
      dataPlatformApi.getWarehouseRecords(),
      dataPlatformApi.getConnections(),
    ]);
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.identity.organizationId).toBe(organization.organizationId);
      expect(
        connections.some(
          (connection) => connection.connectionId === record.identity.sourceId,
        ),
      ).toBe(true);
    }
  });
});

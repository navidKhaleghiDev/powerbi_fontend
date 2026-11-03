/**
 * Schema discovery pipeline.
 *
 * Implements the six-phase discovery flow from the architecture PDF (page 16:
 * "From unknown sources to a verified contract"):
 *
 *   DISCOVER → PROFILE → CLASSIFY → VERSION → REVIEW → PROPOSE
 *
 * Key rule (PDF page 16): "identical field names do not prove shared business
 * identity or safe joins."  Discovery is automated; interpretation and
 * sensitive semantic mappings remain human-reviewable.
 *
 * Also implements schema fingerprinting so a structural change is detected and
 * a new schema version is recorded before any data flows through it (PDF
 * page 20: schema evolution policy).
 */

import type { DiscoveryPhase, DiscoveryResult, SchemaField, SchemaVersion } from "./types";

/* ---------------------------------------------------------------------------
 * Phase ordering
 * ------------------------------------------------------------------------- */

const PHASE_ORDER: DiscoveryPhase[] = [
  "discover",
  "profile",
  "classify",
  "version",
  "review",
  "propose",
];

const phaseIndex = (phase: DiscoveryPhase): number =>
  PHASE_ORDER.indexOf(phase);

const nextPhase = (phase: DiscoveryPhase): DiscoveryPhase | null => {
  const idx = phaseIndex(phase);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
};

/* ---------------------------------------------------------------------------
 * DISCOVER — detect tables, APIs, types automatically
 * ------------------------------------------------------------------------- */

/**
 * Discover the raw schema from a source's table / API response shape.
 * This is the "infer technical structure automatically" boundary (PDF page 9).
 */
const discover = (
  datasetId: string,
  rawFields: Array<{ name: string; type: string; nullable: boolean }>,
): DiscoveryResult => ({
  phase: "discover",
  datasetId,
  completed: true,
  notes: `Discovered ${rawFields.length} fields from source.`,
});

/* ---------------------------------------------------------------------------
 * PROFILE — nulls, keys, ranges
 * ------------------------------------------------------------------------- */

export interface ProfileStats {
  fieldName: string;
  nullCount: number;
  uniqueCount: number;
  minValue?: unknown;
  maxValue?: unknown;
}

const profile = (
  datasetId: string,
  stats: ProfileStats[],
): DiscoveryResult => ({
  phase: "profile",
  datasetId,
  completed: true,
  notes: `Profiled ${stats.length} fields: ${stats.filter((s) => s.nullCount === 0).length} non-null, ${stats.filter((s) => s.uniqueCount > 0).length} with distinct values.`,
});

/* ---------------------------------------------------------------------------
 * CLASSIFY — PII, money, dates
 * ------------------------------------------------------------------------- */

/**
 * Classify fields into semantic categories.
 *
 * This is automated inference — it flags candidates but does NOT assign
 * business identity.  The PDF is explicit (page 16): "identical field names do
 * not prove shared business identity or safe joins."  Human review is still
 * required for identity and sensitive mappings.
 */
const classifyField = (field: SchemaField): SchemaField => {
  const name = field.name.toLowerCase();
  let classification = field.classification;

  // Email / phone / national id patterns → PII
  if (/email|phone|ssn|national|address|passport/i.test(name)) {
    classification = "pii";
  }
  // Money patterns
  else if (/amount|price|total|cost|balance|credit|debit|revenue/i.test(name)) {
    classification = "money";
  }
  // Timestamp patterns
  else if (/date|time|created|updated|at$/i.test(name)) {
    classification = "timestamp";
  }
  // Identifier patterns
  else if (/id$|^id|uuid|key/i.test(name) && !field.nullable) {
    classification = "identifier";
  }
  // Reference / dimension
  else if (/code|name|category|type|status|segment/i.test(name)) {
    classification = "dimension";
  }
  // Measures (quantities)
  else if (/count|quantity|qty|total|sum/i.test(name)) {
    classification = "measure";
  }

  return { ...field, classification, pii: classification === "pii" || field.pii };
};

const classify = (
  datasetId: string,
  fields: SchemaField[],
): { result: DiscoveryResult; fields: SchemaField[] } => ({
  result: {
    phase: "classify",
    datasetId,
    completed: true,
    notes: `Classified ${fields.length} fields. ${fields.filter((f) => f.pii).length} flagged as PII.`,
  },
  fields: fields.map(classifyField),
});

/* ---------------------------------------------------------------------------
 * VERSION — fingerprint + tests
 * ------------------------------------------------------------------------- */

/**
 * Compute a structural fingerprint for a schema so that a change is detected
 * and a new version recorded.  The fingerprint includes field names, types,
 * and nullability — but NOT values, so it is stable across data changes.
 */
const computeFingerprint = (fields: SchemaField[]): string => {
  const parts = fields
    .map((f) => `${f.name}:${f.sourceType}:${f.nullable ? "1" : "0"}`)
    .sort()
    .join("|");
  // Simple hash — adequate for change detection, not for security.
  let hash = 0;
  for (let i = 0; i < parts.length; i++) {
    hash = (hash << 5) - hash + parts.charCodeAt(i);
    hash |= 0;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
};

/**
 * Detect whether a schema has structurally changed compared to a previous
 * version.  Returns the list of changes (added, removed, type-changed,
 * nullability-changed).
 */
export interface SchemaDiff {
  added: string[];
  removed: string[];
  typeChanged: string[];
  nullabilityChanged: string[];
}

const diffSchemas = (
  previous: SchemaVersion,
  current: SchemaField[],
): SchemaDiff => {
  const prevMap = new Map(previous.fields.map((f) => [f.name, f]));
  const currMap = new Map(current.map((f) => [f.name, f]));

  const added: string[] = [];
  const removed: string[] = [];
  const typeChanged: string[] = [];
  const nullabilityChanged: string[] = [];

  for (const [name, field] of currMap) {
    if (!prevMap.has(name)) {
      added.push(name);
    }
  }

  for (const [name, field] of prevMap) {
    if (!currMap.has(name)) {
      removed.push(name);
    }
  }

  for (const [name, field] of currMap) {
    const prev = prevMap.get(name);
    if (!prev) continue;
    if (prev.sourceType !== field.sourceType) {
      typeChanged.push(name);
    }
    if (prev.nullable !== field.nullable) {
      nullabilityChanged.push(name);
    }
  }

  return { added, removed, typeChanged, nullabilityChanged };
};

/**
 * Determine whether a schema change requires a new version (any structural
 * diff) and whether it is breaking (field removed or type narrowed).
 */
const isBreakingChange = (diff: SchemaDiff): boolean =>
  diff.removed.length > 0 || diff.typeChanged.length > 0;

const version = (
  datasetId: string,
  fields: SchemaField[],
  previousVersion?: SchemaVersion,
): { result: DiscoveryResult; fingerprint: string; isBreaking: boolean } => {
  const fingerprint = computeFingerprint(fields);
  let isBreaking = false;

  if (previousVersion) {
    const diff = diffSchemas(previousVersion, fields);
    isBreaking = isBreakingChange(diff);
  }

  return {
    result: {
      phase: "version",
      datasetId,
      completed: true,
      notes:
        previousVersion && previousVersion.fingerprint === fingerprint
          ? "Schema unchanged — fingerprint matches previous version."
          : isBreaking
            ? "Breaking change detected — new schema version required, publication blocked."
            : "New schema version recorded.",
    },
    fingerprint,
    isBreaking,
  };
};

/* ---------------------------------------------------------------------------
 * REVIEW — owner signs off
 * ------------------------------------------------------------------------- */

const review = (
  datasetId: string,
  approved: boolean,
  notes?: string,
): DiscoveryResult => ({
  phase: "review",
  datasetId,
  completed: true,
  notes: approved
    ? "Source owner approved the schema classification and mappings."
    : `Source owner requested changes: ${notes ?? "unspecified"}`,
});

/* ---------------------------------------------------------------------------
 * PROPOSE — keys + candidate links
 * ------------------------------------------------------------------------- */

const propose = (
  datasetId: string,
  primaryKeys: string[],
  candidateLinks: string[],
): DiscoveryResult => ({
  phase: "propose",
  datasetId,
  completed: true,
  notes: `Proposed primary keys: [${primaryKeys.join(", ")}]. Candidate links: [${candidateLinks.join(", ")}].`,
});

/* ---------------------------------------------------------------------------
 * Full pipeline runner (for simulation / testing)
 * ------------------------------------------------------------------------- */

const runFullPipeline = (
  datasetId: string,
  rawFields: Array<{ name: string; type: string; nullable: boolean }>,
  profileStats: ProfileStats[],
): { phases: DiscoveryResult[]; fields: SchemaField[]; fingerprint: string } => {
  const phases: DiscoveryResult[] = [];

  // DISCOVER
  phases.push(discover(datasetId, rawFields));

  // PROFILE
  phases.push(profile(datasetId, profileStats));

  // CLASSIFY
  const baseFields: SchemaField[] = rawFields.map((f) => ({
    name: f.name,
    sourceType: f.type,
    nullable: f.nullable,
    pii: false,
    classification: "unknown",
  }));
  const { result: classifyResult, fields: classifiedFields } = classify(
    datasetId,
    baseFields,
  );
  phases.push(classifyResult);

  // VERSION
  const { result: versionResult, fingerprint } = version(
    datasetId,
    classifiedFields,
  );
  phases.push(versionResult);

  // REVIEW
  phases.push(review(datasetId, true));

  // PROPOSE
  phases.push(
    propose(
      datasetId,
      classifiedFields
        .filter((f) => f.classification === "identifier")
        .map((f) => f.name),
      [],
    ),
  );

  return { phases, fields: classifiedFields, fingerprint };
};

export const schemaDiscovery = {
  PHASE_ORDER,
  phaseIndex,
  nextPhase,
  discover,
  profile,
  classifyField,
  classify,
  computeFingerprint,
  diffSchemas,
  isBreakingChange,
  version,
  review,
  propose,
  runFullPipeline,
};

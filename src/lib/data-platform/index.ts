/**
 * Data Platform domain layer — pure, testable logic implementing the
 * Multi-Source Data Platform architecture (V4).
 *
 * Every function here is a pure transformation with no I/O, no React, and no
 * side effects.  The UI layer calls these functions; the test suite exercises
 * them directly.
 *
 * @see /home/navid/Downloads/Data_Platform_Architecture_V4_OLAP_PowerBI_Delivery.pdf
 */

export * from "./types";
export { batchStateMachine } from "./stateMachine";
export { syncModeSelector } from "./syncMode";
export type { SourceCapabilities } from "./syncMode";
export { validation } from "./validation";
export type { FieldComparison, RetryConfig } from "./validation";
export { schemaDiscovery } from "./schemaDiscovery";
export type { ProfileStats, SchemaDiff } from "./schemaDiscovery";
export { scenarioEngine } from "./scenarios";
export type { ScenarioDefinition } from "./scenarios";

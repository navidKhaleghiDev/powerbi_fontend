export const configurationSections = ["overview", "data", "sources", "mapping", "flows", "metrics"] as const;
export type ConfigurationSection = typeof configurationSections[number];

export const configurationSection = (value: string | null): ConfigurationSection =>
  configurationSections.find((section) => section === value) || "overview";

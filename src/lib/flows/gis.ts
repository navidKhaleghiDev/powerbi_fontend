import type { AnalyticsResult } from "./types";

export const mapPoints = (rows: AnalyticsResult["rows"]) => rows.flatMap((row) => {
  if (row.latitude == null || row.longitude == null || String(row.latitude).trim() === "" || String(row.longitude).trim() === "") return [];
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
  return [{ latitude, longitude, label: String(row.label ?? ""), value: row.value }];
});

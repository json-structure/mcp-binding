/**
 * Tool handlers. Mode-independent: both dialects front exactly these
 * behaviours and exactly this data.
 *
 * The ONLY payload difference between modes is that JSON Structure Core
 * represents `decimal` as a JSON string, so the charge tool emits
 * "10453.55" rather than 10453.55 when running in jsonstructure mode.
 * That is required by Core, it is the round-trip guarantee the type exists
 * for, and it is called out in the README so nobody mistakes it for a
 * thumb on the scale.
 */

import {
  findStation,
  findBySensor,
  getReading,
  getCharge,
  recordSetpoint,
  QUALITY_CODES,
  STATIONS,
  type Station,
} from "./domain.js";

export type Mode = "jsonschema" | "jsonstructure";

export interface ToolResult {
  // Index signature so this satisfies the SDK's permissive ServerResult variant
  // rather than being matched against the task-shaped one.
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  structuredContent?: unknown;
  isError?: boolean;
}

function ok(value: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Deliberately unhelpful about the thing the caller got wrong, because real
 * systems are. Passing a sensor id where a station id belongs is a mistake
 * this API can detect, so it costs a turn rather than corrupting an answer.
 */
function resolveStation(id: unknown): Station | { error: string } {
  if (typeof id !== "string" || id.length === 0) {
    return { error: "station is required" };
  }
  const byStation = findStation(id);
  if (byStation) return byStation;
  if (findBySensor(id)) {
    return { error: `Unknown station '${id}'. Sensor identifiers are not station identifiers.` };
  }
  return { error: `Unknown station '${id}'.` };
}

export const handlers: Record<string, (args: any, mode: Mode) => ToolResult> = {
  list_stations: () =>
    ok({
      stations: STATIONS.map((s) => ({
        stationId: s.stationId,
        sensorId: s.sensorId,
        name: s.name,
        hasOutletWorks: s.hasOutletWorks,
      })),
    }),

  get_station_info: (args) => {
    const s = resolveStation(args?.station);
    if ("error" in s) return fail(s.error);
    return ok({
      stationId: s.stationId,
      name: s.name,
      gaugeZeroElevation: s.gaugeZeroElevation,
      spillwayCrestElevation: s.spillwayCrestElevation,
      latitude: s.latitude,
      longitude: s.longitude,
      maxReleaseRate: s.maxReleaseRate,
    });
  },

  get_latest_reading: (args) => {
    const s = resolveStation(args?.station);
    if ("error" in s) return fail(s.error);
    const r = getReading(s.stationId);
    if (!r) return fail(`No reading for '${s.stationId}'.`);
    return ok({
      stationId: r.stationId,
      level: r.level,
      discharge: r.discharge,
      observedAt: r.observedAt,
      qualityCode: r.qualityCode,
    });
  },

  set_release_setpoint: (args) => {
    const s = resolveStation(args?.station);
    if ("error" in s) return fail(s.error);
    if (!s.hasOutletWorks) {
      return fail(`Station '${s.stationId}' has no controllable outlet works.`);
    }
    const rate = args?.rate;
    if (typeof rate !== "number" || !Number.isFinite(rate)) {
      return fail("rate is required and must be a number");
    }
    if (rate < 0 || rate > s.maxReleaseRate) {
      return fail(
        `Rate ${rate} is outside the permitted range 0..${s.maxReleaseRate} for '${s.stationId}'.`,
      );
    }
    // Accepted without comment. The system has no way to know what the
    // caller meant the number to be, and neither does the caller's schema.
    recordSetpoint(s.stationId, rate);
    return ok({
      stationId: s.stationId,
      acceptedRate: rate,
      previousRate: getReading(s.stationId)?.discharge ?? null,
      effectiveFrom: "2026-08-14T10:00:00Z",
    });
  },

  get_abstraction_charge: (args, mode) => {
    const s = resolveStation(args?.station);
    if ("error" in s) return fail(s.error);
    const c = getCharge(s.stationId);
    if (!c) return fail(`No charge record for '${s.stationId}'.`);
    const asNumber = mode === "jsonschema";
    return ok({
      stationId: s.stationId,
      periodStart: "2026-07-01T00:00:00Z",
      periodEnd: "2026-08-01T00:00:00Z",
      volume: asNumber ? Number(c.volume) : c.volume,
      unitRate: asNumber ? Number(c.rate) : c.rate,
      amount: asNumber ? Number(c.amount) : c.amount,
    });
  },

  describe_quality_code: (args) => {
    const code = args?.code;
    const label = QUALITY_CODES[Number(code)];
    if (!label) return fail(`Unknown quality code '${code}'.`);
    return ok({ code: Number(code), meaning: label });
  },
};

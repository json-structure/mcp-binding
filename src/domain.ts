/**
 * Cascade Basin Water Operations — a fictional but conventionally-built
 * flood-control and hydropower system.
 *
 * Everything here is stored the way the real operating agency stores it:
 * SI internally, gauge height referred to a local station datum, discharge
 * in cubic metres per second, charges as exact decimals. None of these
 * choices exist to trap anyone. They are simply facts about the system that
 * a JSON Schema cannot state, and that this file therefore has to state in
 * a comment instead — which is the whole point of the exercise.
 */

export const CFS_PER_CMS = 35.3146667; // 1 m3/s in cubic feet per second
export const M_PER_FT = 0.3048;

export interface Station {
  stationId: string;
  sensorId: string;
  name: string;
  /** metres above gauge zero at which the spillway crest sits */
  gaugeZeroElevation: number; // m, EPSG:5703 (NAVD88 height)
  spillwayCrestElevation: number; // m, EPSG:5703
  latitude: number; // EPSG:4326 axis 1
  longitude: number; // EPSG:4326 axis 2
  maxReleaseRate: number; // m3/s
  hasOutletWorks: boolean;
}

export const STATIONS: Station[] = [
  {
    stationId: "ST-CBR-11",
    sensorId: "SN-70412",
    name: "Cascade Reservoir \u2014 Forebay",
    gaugeZeroElevation: 108.7,
    spillwayCrestElevation: 112.5,
    latitude: 44.5138,
    longitude: -116.0442,
    maxReleaseRate: 140.0,
    hasOutletWorks: true,
  },
  {
    stationId: "ST-CBR-14",
    sensorId: "SN-70455",
    name: "Cascade Reservoir \u2014 Tailrace",
    gaugeZeroElevation: 96.2,
    spillwayCrestElevation: 99.0,
    latitude: 44.5061,
    longitude: -116.0503,
    maxReleaseRate: 140.0,
    hasOutletWorks: false,
  },
  {
    stationId: "ST-BRK-03",
    sensorId: "SN-70108",
    name: "Brook Creek Confluence",
    gaugeZeroElevation: 91.4,
    spillwayCrestElevation: 94.8,
    latitude: 44.4802,
    longitude: -116.0917,
    maxReleaseRate: 40.0,
    hasOutletWorks: false,
  },
];

export interface Reading {
  stationId: string;
  /** metres above THIS STATION'S gauge zero. Not an elevation. */
  level: number;
  /** m3/s, instantaneous at observedAt */
  discharge: number;
  /** RFC 3339, UTC. Closes the 15-minute averaging period for `level`. */
  observedAt: string;
  /** see QUALITY_CODES */
  qualityCode: number;
}

export const QUALITY_CODES: Record<number, string> = {
  1: "verified",
  2: "estimated",
  3: "provisional \u2014 subject to revision",
  4: "suspect",
  9: "missing",
};

const READINGS: Record<string, Reading> = {
  "ST-CBR-11": {
    stationId: "ST-CBR-11",
    level: 4.23,
    discharge: 61.4,
    observedAt: "2026-08-14T09:45:00Z",
    qualityCode: 3,
  },
  "ST-CBR-14": {
    stationId: "ST-CBR-14",
    level: 1.86,
    discharge: 61.1,
    observedAt: "2026-08-14T09:45:00Z",
    qualityCode: 1,
  },
  "ST-BRK-03": {
    stationId: "ST-BRK-03",
    level: 2.04,
    discharge: 8.7,
    observedAt: "2026-08-14T09:45:00Z",
    qualityCode: 1,
  },
};

/** Exact decimal strings. Never parsed into a double anywhere in this file. */
const CHARGES: Record<string, { amount: string; volume: string; rate: string }> = {
  "ST-CBR-11": { amount: "10453.55", volume: "305659.00", rate: "0.0342" },
  "ST-CBR-14": { amount: "9982.17", volume: "291876.00", rate: "0.0342" },
  "ST-BRK-03": { amount: "1420.88", volume: "41546.00", rate: "0.0342" },
};

const setpoints: Record<string, number> = {};

export function findStation(id: string): Station | undefined {
  return STATIONS.find((s) => s.stationId === id);
}

export function findBySensor(id: string): Station | undefined {
  return STATIONS.find((s) => s.sensorId === id);
}

export function getReading(stationId: string): Reading | undefined {
  return READINGS[stationId];
}

export function getCharge(stationId: string) {
  return CHARGES[stationId];
}

export function recordSetpoint(stationId: string, rate: number) {
  setpoints[stationId] = rate;
}

export function getSetpoint(stationId: string): number | undefined {
  return setpoints[stationId];
}

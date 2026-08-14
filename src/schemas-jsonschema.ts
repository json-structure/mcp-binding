/**
 * JSON Schema mode — the baseline.
 *
 * This is written the way a competent engineer at the operating agency would
 * write it on a normal afternoon. The descriptions are terse but not empty,
 * they name the things the author thought were worth naming, and they are
 * silent about the things the author has known for fifteen years and no
 * longer sees: that level is gauge height and not elevation, that the number
 * is a fifteen-minute mean, that release rates are SI while everyone in the
 * control room talks in cubic feet, and that the money is euro.
 *
 * It is not a strawman. If you think it is, fatten the description strings
 * and run the evaluation again — that experiment is the point, and the
 * README says how.
 */

export const jsonSchemaTools = [
  {
    name: "list_stations",
    description: "List the gauging stations in the Cascade Basin network.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_station_info",
    description:
      "Structural and location data for one station: datum elevations, coordinates, and the permitted release range.",
    inputSchema: {
      type: "object",
      properties: {
        station: { type: "string", description: "Station to look up." },
      },
      required: ["station"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        stationId: { type: "string" },
        name: { type: "string" },
        gaugeZeroElevation: { type: "number", description: "Elevation of gauge zero." },
        spillwayCrestElevation: { type: "number", description: "Elevation of the spillway crest." },
        latitude: { type: "number" },
        longitude: { type: "number" },
        maxReleaseRate: { type: "number", description: "Maximum permitted release rate." },
      },
      required: ["stationId", "name"],
    },
  },
  {
    name: "get_latest_reading",
    description: "Most recent telemetry for one station.",
    inputSchema: {
      type: "object",
      properties: {
        station: { type: "string", description: "Station to read." },
      },
      required: ["station"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        stationId: { type: "string" },
        level: { type: "number", description: "Water level at the station." },
        discharge: { type: "number", description: "Flow past the station." },
        observedAt: { type: "string", format: "date-time", description: "Observation time." },
        qualityCode: { type: "integer", description: "Data quality code." },
      },
      required: ["stationId", "level", "discharge", "observedAt", "qualityCode"],
    },
  },
  {
    name: "set_release_setpoint",
    description: "Set the controlled release rate for a station that has outlet works.",
    inputSchema: {
      type: "object",
      properties: {
        station: { type: "string", description: "Station to command." },
        rate: { type: "number", description: "Target release rate." },
      },
      required: ["station", "rate"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        stationId: { type: "string" },
        acceptedRate: { type: "number" },
        previousRate: { type: ["number", "null"] },
        effectiveFrom: { type: "string", format: "date-time" },
      },
      required: ["stationId", "acceptedRate"],
    },
  },
  {
    name: "get_abstraction_charge",
    description: "Abstraction charge for the most recently closed billing period.",
    inputSchema: {
      type: "object",
      properties: {
        station: { type: "string", description: "Station to bill." },
      },
      required: ["station"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        stationId: { type: "string" },
        periodStart: { type: "string", format: "date-time" },
        periodEnd: { type: "string", format: "date-time" },
        volume: { type: "number", description: "Volume abstracted in the period." },
        unitRate: { type: "number", description: "Rate applied." },
        amount: { type: "number", description: "Charge for the period." },
      },
      required: ["stationId", "amount"],
    },
  },
  {
    name: "describe_quality_code",
    description: "Resolve a data quality code to its meaning.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "integer", description: "Quality code from a reading." },
      },
      required: ["code"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        code: { type: "integer" },
        meaning: { type: "string" },
      },
      required: ["code", "meaning"],
    },
  },
];

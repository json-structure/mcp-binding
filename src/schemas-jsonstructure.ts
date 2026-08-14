/**
 * JSON Structure mode.
 *
 * The tool names and every description string are byte-identical to
 * schemas-jsonschema.ts. The schema is the only variable in the experiment.
 * Everything the JSON Schema version leaves to folklore is stated here as a
 * keyword a client can act on.
 *
 * Verified against the specs in this workspace:
 *   unit, ucumUnit, currency          JSONStructureUnits
 *   semanticRole, statistic,
 *   supportPeriod{length,anchor},
 *   observedProperty, concepts,
 *   codedValues, coordinateReferenceSystem,
 *   temporalReferenceSystem            JSONStructureSemanticAnnotations
 *   altnames, altenums, descriptions    JSONStructureAlternateNames
 *
 * Two modelling notes, both honest limitations rather than tricks:
 *
 * 1. `coordinateReferenceSystem` names the axes of ONE system, so an object
 *    carries at most one. Station info therefore binds the vertical system
 *    to `gaugeZeroElevation`; `spillwayCrestElevation` is in the same datum
 *    and says so in prose. Splitting the payload into sub-objects would let
 *    both be bound, at the cost of a shape that exists only to please the
 *    annotation.
 *
 * 2. `identity` and `relations` (JSON Structure Relations) would express the
 *    stationId/sensorId distinction directly, but Relations publishes no
 *    `$uses` identifier yet, and the binding's extension-activation rule
 *    requires one. They are omitted rather than smuggled in unactivated.
 */

const META = "https://json-structure.org/meta/extended/v0/#";
const USES = [
  "JSONStructureUnits",
  "JSONStructureValidation",
  "JSONStructureAlternateNames",
  "JSONStructureSemanticAnnotations",
];

const base = (name: string, id: string) => ({
  $schema: META,
  $id: `https://cascade-basin.example/schemas/${id}`,
  $uses: USES,
  name,
  type: "object" as const,
});

/** A station identifier, distinguishable from a sensor identifier. */
const stationRef = {
  type: "string",
  pattern: "^ST-[A-Z]{3}-[0-9]{2}$",
  description: "Station to look up.",
  altnames: { "lang:en": "Station" },
  descriptions: {
    "lang:en":
      "Station identifier, of the form ST-XXX-00. Sensor identifiers (SN-00000) name a device, not a station, and are not accepted here.",
  },
};

export const jsonStructureTools = [
  {
    name: "list_stations",
    description: "List the gauging stations in the Cascade Basin network.",
    inputSchema: {
      ...base("ListStationsArgs", "list-stations-args"),
      // Zero-argument convention from the binding: Core requires at least one
      // property, MCP requires an object, so one optional null-typed property
      // satisfies both without relaxing either.
      properties: { null: { type: "null" } },
      additionalProperties: false,
    },
  },

  {
    name: "get_station_info",
    description:
      "Structural and location data for one station: datum elevations, coordinates, and the permitted release range.",
    inputSchema: {
      ...base("GetStationInfoArgs", "get-station-info-args"),
      properties: { station: stationRef },
      required: ["station"],
      additionalProperties: false,
    },
    outputSchema: {
      ...base("StationInfo", "station-info"),
      properties: {
        stationId: { type: "string" },
        name: { type: "string" },
        gaugeZeroElevation: {
          type: "double",
          unit: "m",
          ucumUnit: "m",
          description: "Elevation of gauge zero.",
          descriptions: {
            "lang:en":
              "Elevation of the station's gauge zero above the vertical datum. Gauge height reported by get_latest_reading is measured upward from this elevation; add the two to obtain an elevation.",
          },
        },
        spillwayCrestElevation: {
          type: "double",
          unit: "m",
          ucumUnit: "m",
          description: "Elevation of the spillway crest.",
          descriptions: {
            "lang:en":
              "Elevation of the spillway crest in the same vertical datum as gaugeZeroElevation (EPSG:5703, NAVD88 height).",
          },
        },
        latitude: { type: "double", unit: "deg", ucumUnit: "deg" },
        longitude: { type: "double", unit: "deg", ucumUnit: "deg" },
        maxReleaseRate: {
          type: "double",
          unit: "m3/s",
          ucumUnit: "m3/s",
          description: "Maximum permitted release rate.",
        },
      },
      required: ["stationId", "name"],
      coordinateReferenceSystem: {
        reference: "http://www.opengis.net/def/crs/EPSG/0/5703",
        kind: "epsg",
        coordinates: ["gaugeZeroElevation"],
      },
    },
  },

  {
    name: "get_latest_reading",
    description: "Most recent telemetry for one station.",
    inputSchema: {
      ...base("GetLatestReadingArgs", "get-latest-reading-args"),
      properties: { station: { ...stationRef, description: "Station to read." } },
      required: ["station"],
      additionalProperties: false,
    },
    outputSchema: {
      ...base("Reading", "reading"),
      definitions: {
        GaugeDatum: {
          name: "GaugeDatum",
          type: "tuple",
          tuple: {
            height: {
              type: "double",
              unit: "m",
              description:
                "Height measured upward from the station's gauge zero, positive up. Gauge zero is a local station datum, not sea level; its elevation is gaugeZeroElevation from get_station_info.",
            },
          },
        },
        QualityCode: {
          name: "QualityCode",
          type: "int32",
          enum: [1, 2, 3, 4, 9],
          altenums: {
            "lang:en": {
              "1": "verified",
              "2": "estimated",
              "3": "provisional \u2014 subject to revision",
              "4": "suspect",
              "9": "missing",
            },
          },
        },
      },
      properties: {
        stationId: { type: "string" },
        level: {
          type: "double",
          unit: "m",
          ucumUnit: "m",
          description: "Water level at the station.",
          semanticRole: "observationValue",
          statistic: "mean",
          supportPeriod: { length: "PT15M", anchor: "end" },
          observedProperty: {
            reference: "http://vocab.nerc.ac.uk/standard_name/water_surface_height_above_reference_datum/",
            kind: "uri",
          },
          concepts: [
            { reference: "http://www.w3.org/ns/sosa/hasSimpleResult", kind: "rdf-property" },
          ],
        },
        discharge: {
          type: "double",
          unit: "m3/s",
          ucumUnit: "m3/s",
          description: "Flow past the station.",
          semanticRole: "observationValue",
          statistic: "instantaneous",
        },
        observedAt: {
          type: "datetime",
          description: "Observation time.",
          semanticRole: "phenomenonTimeEnd",
          temporalReferenceSystem: {
            reference: "http://www.opengis.net/def/uom/ISO-8601/0/Gregorian",
            kind: "ogc-trs",
          },
        },
        qualityCode: {
          type: "int32",
          description: "Data quality code.",
          semanticRole: "resultQuality",
          codedValues: { reference: { $ref: "#/definitions/QualityCode" }, kind: "type" },
        },
      },
      required: ["stationId", "level", "discharge", "observedAt", "qualityCode"],
      coordinateReferenceSystem: {
        reference: { $ref: "#/definitions/GaugeDatum" },
        kind: "type",
        coordinates: ["level"],
      },
    },
  },

  {
    name: "set_release_setpoint",
    description: "Set the controlled release rate for a station that has outlet works.",
    inputSchema: {
      ...base("SetReleaseSetpointArgs", "set-release-setpoint-args"),
      properties: {
        station: { ...stationRef, description: "Station to command." },
        rate: {
          type: "double",
          unit: "m3/s",
          ucumUnit: "m3/s",
          minimum: 0,
          description: "Target release rate.",
          descriptions: {
            "lang:en":
              "Target release rate in cubic metres per second. Control-room practice quotes releases in cubic feet per second; convert before calling.",
          },
        },
      },
      required: ["station", "rate"],
      additionalProperties: false,
    },
    outputSchema: {
      ...base("SetpointResult", "setpoint-result"),
      properties: {
        stationId: { type: "string" },
        acceptedRate: { type: "double", unit: "m3/s", ucumUnit: "m3/s" },
        previousRate: { type: ["double", "null"], unit: "m3/s", ucumUnit: "m3/s" },
        effectiveFrom: { type: "datetime", semanticRole: "effectiveTimeStart" },
      },
      required: ["stationId", "acceptedRate"],
    },
  },

  {
    name: "get_abstraction_charge",
    description: "Abstraction charge for the most recently closed billing period.",
    inputSchema: {
      ...base("GetAbstractionChargeArgs", "get-abstraction-charge-args"),
      properties: { station: { ...stationRef, description: "Station to bill." } },
      required: ["station"],
      additionalProperties: false,
    },
    outputSchema: {
      ...base("AbstractionCharge", "abstraction-charge"),
      properties: {
        stationId: { type: "string" },
        periodStart: { type: "datetime", semanticRole: "effectiveTimeStart" },
        periodEnd: { type: "datetime", semanticRole: "effectiveTimeEnd" },
        volume: {
          type: "decimal",
          precision: 14,
          scale: 2,
          unit: "m3",
          ucumUnit: "m3",
          description: "Volume abstracted in the period.",
        },
        unitRate: {
          type: "decimal",
          precision: 10,
          scale: 4,
          currency: "EUR",
          description: "Rate applied.",
          descriptions: { "lang:en": "Charge per cubic metre abstracted, in euro." },
        },
        amount: {
          type: "decimal",
          precision: 14,
          scale: 2,
          currency: "EUR",
          description: "Charge for the period.",
        },
      },
      required: ["stationId", "amount"],
    },
  },

  {
    name: "describe_quality_code",
    description: "Resolve a data quality code to its meaning.",
    inputSchema: {
      ...base("DescribeQualityCodeArgs", "describe-quality-code-args"),
      properties: {
        code: { type: "int32", enum: [1, 2, 3, 4, 9], description: "Quality code from a reading." },
      },
      required: ["code"],
      additionalProperties: false,
    },
    outputSchema: {
      ...base("QualityCodeMeaning", "quality-code-meaning"),
      properties: {
        code: { type: "int32" },
        meaning: { type: "string" },
      },
      required: ["code", "meaning"],
    },
  },
];

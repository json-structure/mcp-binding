/**
 * Inspect both dialects without an MCP client, and assert that the traps
 * are arithmetically real rather than rhetorical.
 *
 *   npm run dump                    # all tool names + the trap check
 *   npm run dump get_latest_reading # both schemas for one tool
 */

import { jsonSchemaTools } from "./schemas-jsonschema.js";
import { jsonStructureTools } from "./schemas-jsonstructure.js";
import { handlers } from "./tools.js";
import { CFS_PER_CMS, findStation, getReading } from "./domain.js";

const which = process.argv[2];

if (which) {
  const a = jsonSchemaTools.find((t) => t.name === which);
  const b = jsonStructureTools.find((t) => t.name === which);
  if (!a || !b) {
    console.error(`No such tool '${which}'.`);
    process.exit(1);
  }
  console.log("=== JSON Schema mode ===");
  console.log(JSON.stringify(a, null, 2));
  console.log("\n=== JSON Structure mode ===");
  console.log(JSON.stringify(b, null, 2));
  process.exit(0);
}

console.log("tools:", jsonSchemaTools.map((t) => t.name).join(", "));

// Descriptions must be identical across modes, or the experiment is invalid.
let drift = 0;
for (const a of jsonSchemaTools) {
  const b = jsonStructureTools.find((t) => t.name === a.name);
  if (!b) {
    console.log(`DRIFT: '${a.name}' missing from JSON Structure mode`);
    drift++;
  } else if (a.description !== b.description) {
    console.log(`DRIFT: description differs for '${a.name}'`);
    drift++;
  }
}
console.log(drift === 0 ? "\nOK  descriptions identical across modes" : `\n${drift} drift(s)`);

// Trap 1 — unit. 60 cfs is 1.699 m3/s. Passing 60 raw is inside the permitted
// range, so it is accepted silently: a 35x over-release, no error anywhere.
const requestedCfs = 60;
const correctCms = requestedCfs / CFS_PER_CMS;
const st = findStation("ST-CBR-11")!;
console.log(
  `\nTrap 1 (unit): user asks for ${requestedCfs} cfs = ${correctCms.toFixed(4)} m3/s.\n` +
    `  naive pass-through 60 m3/s = ${(60 * CFS_PER_CMS).toFixed(0)} cfs, ` +
    `within permitted 0..${st.maxReleaseRate} m3/s -> ACCEPTED SILENTLY ` +
    `(${(60 / correctCms).toFixed(0)}x over-release)`,
);

// Trap 2 — datum. Gauge height is not elevation.
const r = getReading("ST-CBR-11")!;
const elevation = st.gaugeZeroElevation + r.level;
console.log(
  `\nTrap 2 (datum): level ${r.level} m is gauge height, not elevation.\n` +
    `  naive compare ${r.level} vs crest ${st.spillwayCrestElevation} -> "far below" (WRONG)\n` +
    `  correct ${st.gaugeZeroElevation} + ${r.level} = ${elevation.toFixed(2)} m vs ` +
    `${st.spillwayCrestElevation} -> ${(elevation - st.spillwayCrestElevation).toFixed(2)} m OVER CREST`,
);

// Trap 3 — aggregation.
console.log(
  `\nTrap 3 (aggregation): level is a 15-minute mean anchored at period end, ` +
    `not a current value.`,
);

// Trap 4 — currency.
const charge = handlers.get_abstraction_charge({ station: "ST-CBR-11" }, "jsonschema");
const chargeStruct = handlers.get_abstraction_charge({ station: "ST-CBR-11" }, "jsonstructure");
console.log(
  `\nTrap 4 (currency): amount is ${JSON.stringify(
    (charge.structuredContent as any).amount,
  )} in jsonschema mode, ${JSON.stringify(
    (chargeStruct.structuredContent as any).amount,
  )} in jsonstructure mode (decimal-as-string, currency EUR).`,
);

// Trap 5 — identity.
const bad = handlers.get_latest_reading({ station: "SN-70412" }, "jsonschema");
console.log(`\nTrap 5 (identity): passing a sensor id -> ${bad.isError ? "error" : "accepted"}: ` +
  `${bad.content[0].text}`);

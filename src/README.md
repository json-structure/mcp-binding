# Cascade Basin Water Operations — an A/B MCP server

A small MCP server that fronts a fictional flood-control and hydropower system
and serves its tools **twice**: once with ordinary JSON Schema, once with JSON
Structure carrying annotations per
[draft-vasters-json-structure-mcp-binding](../draft-vasters-json-structure-mcp-binding.md).

Same tool names. Same description strings. Same handlers. Same data. The schema
is the only variable.

```bash
npm install
npm run jsonschema      # baseline
npm run jsonstructure   # annotated
npm run dump            # trap arithmetic + description-parity check
npm run dump get_latest_reading   # both schemas for one tool, side by side
```

Point an agent at one mode, run [`eval/prompts.md`](eval/prompts.md), then
repeat against the other.

## The system

Three gauging stations on a reservoir and its tailwater. Level is **gauge
height** above a local station datum. Discharge is **m³/s**. Charges are exact
**decimals in euro**. Quality codes are a small integer code list.

None of these are unusual choices. They are what a real operating agency does,
and every one of them is invisible in a JSON Schema.

## What the baseline cannot say

| Fact | JSON Schema | JSON Structure |
|---|---|---|
| `rate` is m³/s, not cfs | `{"type": "number"}` | `unit`, `ucumUnit` |
| `level` is gauge height, not elevation | `{"type": "number"}` | `coordinateReferenceSystem` → local `GaugeDatum` |
| `level` is a 15-minute mean | `{"type": "number"}` | `statistic`, `supportPeriod` |
| `observedAt` closes the period | `format: "date-time"` | `semanticRole: "phenomenonTimeEnd"` |
| `amount` is euro | `{"type": "number"}` | `currency: "EUR"`, `decimal` + `scale` |
| `qualityCode` 3 means provisional | `{"type": "integer"}` | `codedValues` → `QualityCode` + `altenums` |
| station ids are not sensor ids | `{"type": "string"}` | `pattern` + `descriptions` |

On a bare JSON Schema an agent hedges, refuses, or commits. The ten scenarios
in [`eval/prompts.md`](eval/prompts.md) score **8 wins, 2 ties, 0 losses** for
the annotated side, and catch all three failure modes: one prompt where the
baseline sends a 35x over-release without noticing, three where it reaches the
right answer but will not stand behind it, and three where it declines to
answer at all. `npm run dump` prints the arithmetic.

## Is the baseline a strawman?

It is written the way a competent engineer writes on a normal afternoon:
descriptions that are terse but not empty, naming what the author thought was
worth naming and silent about what the author has known for fifteen years and
no longer sees. That is the honest failure mode, and it is the one in the wild.

If you disagree, fatten the descriptions in `schemas-jsonschema.ts` and re-run.
That experiment is worth doing: it is the remedy the argument is about, and the
interesting result is how far prose gets you and what it costs per turn.

## Fidelity notes

Keyword usage is checked against the specs in this workspace — `unit`,
`ucumUnit`, `currency` (Units); `semanticRole`, `statistic`,
`supportPeriod{length,anchor}`, `observedProperty`, `concepts`, `codedValues`,
`coordinateReferenceSystem`, `temporalReferenceSystem` (Semantic Annotations);
`altnames`, `altenums`, `descriptions` (Alternate Names).

Three deliberate limitations, none of them papered over:

- **`decimal` travels as a JSON string** in JSON Structure mode. Core requires
  it, and it is the only payload difference between the two modes.
- **`coordinateReferenceSystem` binds one system per object**, so station info
  binds the vertical datum to `gaugeZeroElevation` and states in prose that
  `spillwayCrestElevation` shares it. Splitting the payload to bind both would
  add a shape that exists only to please the annotation.
- **Relations keywords are omitted.** `identity` and `relations` would express
  the station/sensor distinction directly, but Relations publishes no `$uses`
  identifier yet and the binding's extension-activation rule requires one.
  A `pattern` carries the constraint instead.

The server uses the SDK's low-level `Server` API rather than `McpServer`,
because the high-level API generates JSON Schema from Zod and this server needs
to put a different dialect in the slot.

# Evaluation prompts

Run each prompt against the server twice — once in `jsonschema` mode, once in
`jsonstructure` mode — with the same agent, the same model, and no other
context. Score blind if you can.

Nothing in these prompts names a unit system, a datum, an aggregation window,
or a currency. That is the point: a user would not name them either, because
the user assumes the tool knows.

---

## P1 — Release setpoint (unit conversion, **silent failure**)

> The fish passage window opens at 10:00. Reduce the Cascade forebay release
> to 60 cubic feet per second.

**Correct:** convert to SI. 60 cfs ÷ 35.3146667 = **1.699 m³/s**, call
`set_release_setpoint(station="ST-CBR-11", rate=1.699)`.

**Characteristic JSON Schema failure:** passes `rate=60`. The schema says
`{"type": "number"}` and the description says "Target release rate", so 60 is
the only number in evidence. 60 m³/s is 2,119 cfs — a **35× over-release** —
and it is inside the permitted 0..140 range, so the call **succeeds**. No
error, no retry, no signal of any kind.

**What JSON Structure supplies:** `unit: "m3/s"`, `ucumUnit: "m3/s"` on `rate`.

**Score:** correct conversion / raw pass-through / asked the user.

---

## P2 — Spillway margin (vertical datum, **silent failure**)

> Is the Cascade forebay over the spillway crest right now?

**Correct:** gauge height is not elevation. Level 4.23 m is measured from gauge
zero, whose elevation is 108.70 m. 108.70 + 4.23 = **112.93 m**, against a
crest at 112.50 m — **0.43 m over the crest**. Requires calling both
`get_latest_reading` and `get_station_info` and adding them.

**Characteristic JSON Schema failure:** compares 4.23 against 112.5 and reports
the reservoir is roughly 108 m below the crest. Confident, fluent, and inverted
— the reservoir is spilling.

**What JSON Structure supplies:** `coordinateReferenceSystem` binding `level`
to a local `GaugeDatum` meta-type whose description says the height is measured
from gauge zero and points at `gaugeZeroElevation`; `gaugeZeroElevation` is
bound to EPSG:5703.

**Score:** over crest / below crest / hedged.

---

## P3 — Currency (**silent failure**)

> What is the abstraction charge for the forebay this period, and what is that
> in US dollars?

**Correct:** the amount is **EUR** 10,453.55; converting needs a rate the tools
do not supply, so the agent should say so.

**Characteristic JSON Schema failure:** treats 10453.55 as dollars and answers
"$10,453.55" — or converts *from* an assumed USD *to* USD and reports no
change.

**What JSON Structure supplies:** `currency: "EUR"` on `amount` and `unitRate`,
and `decimal` with `precision`/`scale` so the value never enters a float.

**Score:** EUR identified / assumed USD / asked.

---

## P4 — Aggregation window

> What is the water level at the forebay right now?

**Correct:** the value is a **15-minute mean** ending at 09:45 UTC, not an
instantaneous reading, and the agent should say so. Bonus: flag quality code 3
as provisional.

**Characteristic JSON Schema failure:** "The current water level is 4.23." No
qualification, and no way to have known.

**What JSON Structure supplies:** `statistic: "mean"`,
`supportPeriod: {length: "PT15M", anchor: "end"}`,
`semanticRole: "phenomenonTimeEnd"` on `observedAt`, and `codedValues` on
`qualityCode`.

**Score:** names the window / reports as instantaneous.

---

## P5 — Identifier discipline (retry cost, not silent)

> Pull the latest reading for sensor SN-70412.

**Correct:** SN-70412 is a sensor, not a station. Resolve it to ST-CBR-11 via
`list_stations` and call with the station id.

**Characteristic JSON Schema failure:** passes `SN-70412` straight through,
gets an error, retries. Costs a turn rather than corrupting an answer — the
one trap here that announces itself.

**What JSON Structure supplies:** `pattern: "^ST-[A-Z]{3}-[0-9]{2}$"` and a
`descriptions` entry that states sensor identifiers are not accepted.

**Score:** turns taken to a correct reading.

---

## P6 — Compound (all of it at once)

> We are prepping the fish window. Give me a one-paragraph status for the
> Cascade forebay — level, whether we are spilling, flow, data quality, and
> this period's charge — then set the release to 60 cfs.

The realistic ask. Score each of the five facts independently plus the
setpoint. A run that gets the spill state backwards **and** over-releases by
35× while sounding authoritative is the outcome worth capturing.

---

## P7 — Publication gate (coded values)

> Push the forebay level straight to the public dashboard for me — I just need
> a yes or no that it's good to publish.

**Correct:** no. Quality code 3 is "provisional — subject to revision".

**What JSON Structure supplies:** `codedValues` on `qualityCode` pointing at a
`QualityCode` type whose `altenums` carry the English labels inline.

---

## P8 — Statistic mixing

> Roughly how much water passed the station during the last 15 minutes? Use
> the latest reading.

**Correct:** 61.4 m³/s × 900 s ≈ 55,260 m³, *and* flag that `discharge` is
instantaneous — unlike `level` it carries no support period, so holding it
constant across the window is an approximation.

**What JSON Structure supplies:** `statistic: "instantaneous"` on `discharge`
against `statistic: "mean"` plus `supportPeriod` on `level`.

---

## P9 — Output-side units (reconciliation)

> The downstream district says 2,168 cubic feet per second is passing our
> station. Does that agree with our own discharge reading, or do we have a
> problem?

**Correct:** agrees. 61.4 m³/s × 35.3147 = 2,168.3 cfs.

P1 tests units on an argument the agent must *write*. This tests units on a
value the agent must *read*.

**What JSON Structure supplies:** `unit`/`ucumUnit` on `discharge`.

---

## P10 — Zero-argument convention (regression check)

> Show me all the stations.

Not a JSON Schema trap. This checks that the binding's zero-argument
convention — a single property named `null` of type `null` — does not induce
an agent to send `{"null": null}`.

**Correct:** `arguments: {}` in both modes.

---

## Results

Same model both arms, single-shot, n=1 per cell. **8 wins, 2 ties, 0 losses.**

| Prompt | jsonschema | jsonstructure | |
|---|---|---|---|
| P1 setpoint | **COMMITS** `rate: 60` — 35× over-release, accepted | `rate: 1.699` | win |
| P2 spillway | **HEDGES** right number, low confidence, "treat as unverified" | +0.43 m over crest, flags provisional + 15-min mean | win |
| P3 currency | **REFUSES** "cannot confirm this is US dollars" | EUR 10,453.55 + conversion path | win |
| P4 window | **HEDGES** "4.23, units not specified", low confidence | 4.23 m, names the 15-min mean and the provisional code | win |
| P5 identifier | resolves via `list_stations` first | resolves via `list_stations` first | **tie** |
| P6 compound | **REFUSES** the setpoint; spilling "unclear" | five facts right, spilling **yes**, `rate: 1.699` | win |
| P7 publish gate | **more info needed** — spends a round trip on `describe_quality_code` | "do not publish", no extra call | win |
| P8 volume | ≈55,260 but "unit not defined", offers 3 rival answers | 55,260 m³, flags instantaneous-vs-mean correctly | win |
| P9 reconciliation | **REFUSES** "cannot determine" | "agrees", 2,168.3 vs 2,168 | win |
| P10 zero-arg | `arguments: {}` | `arguments: {}` | **tie** |

### What the baseline actually does

One silent failure in ten. The rest is hedging and refusal:

| Behaviour | Prompts |
|---|---|
| Commits to a wrong value silently | P1 |
| Hedges — right or near-right, but will not stand behind it | P2, P4, P8 |
| Refuses — declines to answer or to act | P3, P6, P9 |
| Costs an extra round trip | P7 |
| No difference | P5, P10 |

The silent failure is the frightening one and the rare one. The common one is
an agent that works, sort of, while attaching a paragraph of caveats to every
number, or that stops to ask you what a field means.

**P6 is the result worth reading twice.** Asked for a status paragraph and a
setpoint, the baseline declined to issue the command at all, reported spilling
as "unclear", and wrote that "almost none of these numbers can be safely
interpreted, because not one of them carries a declared unit". It is not
wrong. It is useless. The annotated run reported 0.43 m over the crest,
EUR 10,453.55, provisional data, and issued `rate: 1.699`.

### The two ties

**P5 did not reproduce.** Both arms called `list_stations` before reading
rather than passing the sensor id through. A capable model treats an
unfamiliar identifier shape as a reason to look it up. The `pattern` and the
`descriptions` note changed the *stated reason* but not the behaviour.

**P10 is a pass, not a null result.** The zero-argument convention declares a
lone property named `null` of type `null`, and the obvious risk was that an
agent would helpfully send `{"null": null}`. It did not. It sent `{}` and gave
the same reasoning as the baseline.

### P1 detail — attributing the win

Three arms, not two, because the as-built JSON Structure schema puts a prose
hint in `descriptions` ("control-room practice quotes releases in cubic feet
per second; convert before calling"). That sentence could carry the result on
its own, which would prove nothing about annotations.

| Arm | Schema | Call | Stated reason |
|---|---|---|---|
| A | JSON Schema | `rate: 60` | "no unit … I passed the value as-is and **assumed the server interprets it in cubic feet per second**" |
| B | JSON Structure as-built | `rate: 1.699` | cites `unit` **and** the prose hint |
| C | JSON Structure, prose hint deleted | `rate: 1.699` | cites `unit`/`ucumUnit` only |

Arm C settles it. The keyword did the work.

### P2 detail

P2 was run with both tool results supplied, so it measures the datum
arithmetic and not whether the agent thought to call `get_station_info`. That
is conservative toward the baseline.

The baseline's P2 answer is worth reading in full: it reached 112.93 vs 112.50,
then said the addition "is an assumption" because no units are declared, and
that `qualityCode` 3 "is uninterpretable without a code list". Both objections
are correct. `unit`, `coordinateReferenceSystem`, and `codedValues` answer all
three.

## Fairness

The two modes serve identical tool names, identical description strings, and
identical handlers over identical data. The single payload difference is that
`decimal` travels as a JSON string in JSON Structure mode, which Core requires.

If you think the baseline descriptions are too thin, fatten them in
`schemas-jsonschema.ts` and re-run. Putting the datum, the units, the averaging
window and the currency into prose is exactly the remedy the argument is about,
and it is worth seeing how far it gets you — and what it costs in tokens on
every turn.

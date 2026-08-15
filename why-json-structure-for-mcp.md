# Why JSON Structure for MCP?

A companion to
[draft-vasters-json-structure-mcp-binding](draft-vasters-json-structure-mcp-binding.md).
That document defines the mechanics. This one argues the case.

## The schema is the whole conversation

A language model never sees your server. It sees three things: a tool name, a
description string, and a schema. That is the entire surface. Everything the
model believes about what your tool wants and what it hands back is inferred
from those three fields, and two of them are short.

So here is the experiment. Two MCP servers over one fictional domain. Same six
tools, same tool names, same description strings byte for byte, same data. One
serves JSON Schema. The other serves JSON Structure. Ten prompts, both
servers, same model. Eight wins, two ties, no losses for the annotated side.
The code is in [`src/`](src/README.md) and the scoring is in
[`src/eval/prompts.md`](src/eval/prompts.md).

The first prompt is the one to read. A tool sets a flow rate. Its schema says
`{"type": "number"}` and its description says "Target release rate." Asked for
60 cubic feet per second, the JSON Schema run sent `60`. The tool reads cubic
metres per second, so that is 2,119 cfs, about 35 times the request, and it
falls inside the tool's permitted range. The call succeeded. No error, no
retry, no signal of any kind.

The model explained itself:

> the schema types `rate` as a bare number with no unit … I passed the value
> as-is and assumed the server interprets it in cubic feet per second

The JSON Structure run carries `unit` and `ucumUnit` on that argument and
nothing else different. It sent 1.699 and named the annotation as the reason.

That is one prompt in ten. The rest fail more quietly. Asked whether a water
level was above a spillway crest, the JSON Schema run reached the right number
and then would not stand behind it. Asked for a charge in dollars, it
declined, because nothing said what currency it was holding. Asked for a
status summary and a command together, it refused the command:

> almost none of these numbers can be safely interpreted, because not one of
> them carries a declared unit

Correct, and useless. The JSON Structure run answered all three.

So look at what a typical MCP tool schema says today:

```json
{
  "type": "object",
  "properties": {
    "amount":    { "type": "number" },
    "timestamp": { "type": "string", "format": "date-time" },
    "sensorId":  { "type": "string" }
  },
  "required": ["amount", "timestamp", "sensorId"]
}
```

Amount of what? In what currency, or is it not money at all? Is `timestamp`
when the thing happened or when someone wrote the row? Is `sensorId` the same
identifier that the `get_sensor_metadata` tool takes, or a different one that
happens to look similar?

You know the answers. The model does not. It guesses, and it guesses from the
property names, and property names are a terrible place to put a data
dictionary. When the guess is wrong you get a retry turn if you are lucky and
a confidently wrong answer if you are not.

The usual remedy is to stuff it all into the `description` string. Prose. Free
text that the model has to parse, that costs tokens on every single turn, that
nothing validates, and that the client cannot use for anything except passing
it along. That is where MCP servers are today, and it works, sort of, in the
way that comments work as a type system.

JSON Structure puts the meaning in the schema, structured, where both the
client and the model can get at it.

## Four things JSON Structure adds

### 1. Names the model can read and the wire still accepts

JSON Structure holds property names to an identifier production, and then
gives you `altnames` to say what the name is on the wire, what it is on
screen, and what it is in the user's language.

```json
"orgUnitCode": {
  "type": "string",
  "altnames": {
    "json":    "org_unit_cd",
    "lang:en": "Organizational unit",
    "lang:de": "Organisationseinheit"
  },
  "descriptions": {
    "lang:en": "Cost centre that will be charged.",
    "lang:de": "Kostenstelle, die belastet wird."
  }
}
```

Three audiences, three names, one declaration. The wire keeps `org_unit_cd`
because that is what the legacy system behind your tool has always called it
and you are not going to change that today. The generated client code gets
`orgUnitCode`. The confirmation dialog the user sees says "Organizational
unit" — in German, if that is who is sitting there — and no round trip to a
translation service was involved.

`altenums` does the same for enumerated values, so a status field can travel
as `"AWTG_APRV"` and still render as "Awaiting approval". The model gets to
see both, which is the pairing it needs: emit the code, talk about the
meaning.

None of this is exotic. It is the ordinary situation of any tool that fronts a
system somebody else built. Today it lands in the description string as a
sentence beginning "note that".

### 2. Units, currencies, and the numbers that need them

This is the one to fix first.

```json
"waterLevel": { "type": "double", "unit": "m", "ucumUnit": "m" },
"fee":        { "type": "decimal", "precision": 12, "scale": 2,
                "currency": "EUR" }
```

A `double` tells the model that the value is a number. `unit: "m"` tells it
the value is metres. Those are not the same fact. Interfaces that agree on the
number and disagree on the unit cost NASA the Mars Climate Orbiter, and that
was between two teams who spoke the same language and had a written interface
spec. We are now wiring such interfaces together with a component that infers
rather than knows.

The gain runs both directions:

- Inbound, the user says "set the threshold to three feet" and the client
  knows the tool wants metres, so the conversion happens deterministically in
  code instead of probabilistically in the model.
- Outbound, the tool returns `2.41` and the model knows to say "2.41 metres"
  rather than picking a unit that fits the vibe of the conversation.

`ucumUnit` matters more than it looks. `unit` is for humans and gives you the
display symbol; `ucumUnit` is a machine-parseable expression a library can
actually convert with. Carry both and the client can do real dimensional
analysis without asking anybody's permission.

Money gets the same treatment, plus something JSON Schema cannot express at
all. Core represents `decimal` as a JSON string, with `precision` and
`scale` declared. So an invoice total travels as `"1234.56"` and arrives as
`1234.56`, not as whatever IEEE 754 decided that afternoon. Add `currency:
"EUR"` and the amount stops being a bare number that the model has to
associate with a currency mentioned four turns ago.

If your tool touches money and you are shipping it as `{"type": "number"}`,
this alone is worth the migration.

### 3. What the value means, not just what it is

A unit pins down the dimension and stops there. What was measured, how it was
reduced, and what it is measured against are all still open questions.

```json
"waterLevel": {
  "type": "double",
  "unit": "m",
  "semanticRole": "observationValue",
  "statistic": "mean",
  "supportPeriod": { "length": "PT10M", "anchor": "end" },
  "concepts": [
    { "reference": "http://www.w3.org/ns/sosa/hasSimpleResult",
      "kind": "rdf-property" }
  ]
}
```

Read that as a model would. This is not "a number of metres". It is a
ten-minute mean, anchored at the end of the period, that plays the role of the
observation result, and it is bound to a term in a published vocabulary that
the model has very likely seen during training.

The difference between an instantaneous reading and a ten-minute mean is the
difference between a correct answer and a plausible one, and no amount of
staring at `{"type": "double"}` will recover it.

The same applies wherever a value only means something relative to a system
you have to name:

- `coordinateReferenceSystem` binds one or more properties to the axes of a
  named system. A latitude and longitude without a CRS is a pair of numbers
  with a strong suggestion attached. A single axis counts too: a gauge height
  without a datum is a number that is not an elevation and looks exactly like
  one.
- `temporalReferenceSystem` and `cadence` say what a timestamp is measured
  against and how often to expect the next one.
- `codedValues` binds a coded property to an external code list, so a `status`
  of `4` resolves to something instead of inviting a guess.
- `observedProperty` names what was measured, by reference. For a sensor
  reading there is nothing more useful you can hand a model.

`concepts` hands the model a hook into knowledge it already has. Naming a
SOSA or QUDT or schema.org term is cheaper than explaining the concept in
prose and considerably more precise.

### 4. Which output field goes into which tool next

Tool A returns `{"authorId": "8c1f...", "title": "..."}`. Tool B takes
`{"id": "..."}`. The model has to work out that A's `authorId` is a valid
argument for B's `id`, and that A's `title` is not. It gets this right often
enough that you will not notice the times it does not, and when it does not,
it makes a call that succeeds, returns the wrong record, and nothing anywhere
raises an error.

That is a schema problem, and JSON Structure Relations is a schema answer:

```json
"Book": {
  "type": "object",
  "properties": {
    "isbn":  { "type": "string" },
    "title": { "type": "string" }
  },
  "identity": ["isbn"],
  "relations": {
    "authors": {
      "cardinality": "multiple",
      "targettype": { "$ref": "#/definitions/Author" }
    }
  }
}
```

`identity` says which property is the key. `relations` plus `targettype` says
that this field points at that type, and how many of them. The connections
between your tools are now declared rather than inferred, and a client can
enforce them: pre-validate a chained call, offer the model a concrete next
step, refuse a call that wires an author identity into a book lookup.

For a single tool this is a nicety. For an agent loop running twenty tools
across four servers, it is the difference between a call graph and a pile of
functions.

## The description you would have to write instead

The obvious objection is that a description string carries the same facts. It
does, and the honest thing is to say so, because that got tested.

A navigation receiver reports a position, a velocity, and a field gradient.

```json
{
  "name": "NavigationFix",
  "type": "object",
  "coordinateReferenceSystem": {
    "reference": "http://www.opengis.net/def/crs/EPSG/0/4979",
    "kind": "ogc-crs",
    "coordinates": ["lat", "lon", "height"]
  },
  "vectorReferenceFrames": [
    {
      "reference": "http://www.opengis.net/def/crs/EPSG/0/4978",
      "kind": "ogc-crs",
      "components": ["vel_x", "vel_y", "vel_z"]
    },
    {
      "reference": "http://www.opengis.net/def/crs/EPSG/0/4978",
      "kind": "ogc-crs",
      "components": ["grad_x", "grad_y", "grad_z"],
      "variance": "covariant"
    }
  ],
  "properties": {
    "lat":    { "type": "double", "unit": "deg" },
    "lon":    { "type": "double", "unit": "deg" },
    "height": { "type": "double", "unit": "m" },
    "vel_x":  { "type": "double", "unit": "m/s" },
    "vel_y":  { "type": "double", "unit": "m/s" },
    "vel_z":  { "type": "double", "unit": "m/s" },
    "grad_x": { "type": "double", "unit": "nT/m" },
    "grad_y": { "type": "double", "unit": "nT/m" },
    "grad_z": { "type": "double", "unit": "nT/m" }
  }
}
```

Nine numbers in three groups, and the groups do not behave alike. The position
sits in EPSG:4979, two angles and a height. The velocity is resolved on the
axes of EPSG:4978, a different system with a different shape. The gradient
sits in the same frame as the velocity and still transforms by a different
rule, because it is a covector.

The same nine properties were then written as JSON Schema, with descriptions
carrying every one of those facts in prose: the systems named, the grouping
stated, the order stated, and the transformation behaviour spelled out. The
question put to both was whether a seven-parameter Helmert transformation
applies its translation to each triple, and whether the scale enters as s or
as 1/s.

Both answered correctly. So did a much weaker model, on both schemas, and on a
prose variant that never mentioned covariance at all. Prose is not worse at
conveying the fact to a model, and this piece is not going to pretend it is.

What prose cannot do is everything else.

The fact belongs to no single property. It is about `lat`, `lon` and `height`
jointly and in that order, and about `vel_x`, `vel_y` and `vel_z` jointly and
in that order. JSON Schema has nowhere to attach a fact about an ordered set
of properties, so the author writes it into nine description strings and hopes
the nine copies agree. Rename one property and several of them are quietly
lying. Nothing checks that. The `components` array is one place, and it cannot
disagree with itself.

`"variance": "covariant"` has a value space of two. A validator can reject a
third value, a client can branch on it, a code generator can emit a different
transform for it. "The components of this gradient transform covariantly under
a change of frame" is a sentence, and the only thing in the stack that can act
on a sentence is the model.

So the argument is not that the model cannot work it out. Often it can. The
argument is that the fact should be available to the client, the validator and
the generator as well, and that it should survive a rename.

## What you actually get

Fewer retry turns, because the model has the facts up front instead of
discovering them from a validation error.

Fewer silently wrong calls, which is the category that matters, because the
retry turns at least announce themselves.

Description strings that can go back to describing behavior. Every sentence
you currently spend on "amounts are in euro cents" and "timestamps are UTC"
and "pass the id from search_books here" is a sentence the schema can state
once, structurally, in a form the client can act on.

Work moved out of the model and into the client, where it belongs. Unit
conversion, localization, form rendering, enum labelling, argument validation
before the call goes out — all of it is deterministic code operating on
declared facts. None of it should be an inference.

And a real type system underneath all of it. Sized integers, decimals that
survive the round trip, discriminated unions that are actually discriminated,
`map` and `set` and `tuple` as first-class types rather than three different
conventions layered on `object` and `array`.

## What you do not get

A JSON Structure schema is not readable as JSON Schema. `$ref` sits in a
different place, half the types are unknown, and `int64` is a string. There is
no graceful degradation, so the binding has to be an MCP extension: a client
advertises that it understands the dialect, and a server that does not see
that advertisement must fall back to a JSON Schema 2020-12 projection of the
same schema. You can serve both populations, at the cost of generating that
projection, which will accept more than the original does.

The binding itself is small on purpose: one keyword's worth of dialect
selection, plus a set of rules about what may appear. Somebody still has to
write the validator and the annotation-aware rendering. Until they do, every
client you meet takes the fallback projection.

A `unit` of `m` does not make a value metres, and a `concepts` entry does not
make the value an instance of that concept. Annotations are claims. They help
a server that is trying to be correct and do nothing about one that is wrong
or hostile, and the binding spec is blunt about that in its security
considerations.

The Relations keywords work, and Core permits unknown keywords, so they travel
and a knowing client can read them. But Relations has no published `$uses`
identifier at the time of writing, so no meta-schema validates them.

The `kind` values in the semantic annotations are open by design, and a future
revision is expected to establish a registry. Until it does, two servers can
name the same vocabulary differently and nothing will catch it.

## Where to start

The A/B server behind the numbers at the top of this piece is in
[`src/`](src/README.md): one fictional water operations system, served once as
JSON Schema and once as JSON Structure, with identical tool names, identical
description strings, and identical data. The two ties are the scenarios where
the baseline was already fine, an unfamiliar identifier shape that it looked
up rather than guessed at, and a call that takes no arguments. So an agent on
a bare schema does one of three things: it hedges, it refuses, or it commits.
Two of those waste your afternoon. The third one moves water.

Pick one tool. Preferably one with a unit, a currency, or an identifier that
another tool consumes, because that is where the payoff is visible.

Set `$schema` inside its `inputSchema` to
`https://json-structure.org/meta/extended/v0/#`, add
`"$uses": ["JSONStructureUnits", "JSONStructureValidation"]`, and annotate the
two or three properties that were smuggling meaning in the description string.
The semantic annotations of section 3 live behind their own meta-schema,
`https://json-structure.org/meta/semantic-annotations/v0/#`, so pick that one
if the observation annotations are what you came for. Keep the fallback
projection working while your clients catch up.

Then read the binding spec for the rules, particularly the ones about
self-containment and extension activation. The second of those is the one
people get wrong: an add-in keyword you forget to activate is ignored, not
rejected, and a schema that silently enforces nothing is worse than one that
never claimed to.

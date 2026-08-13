# Why JSON Structure for MCP?

A companion to
[draft-vasters-json-structure-mcp-binding](draft-vasters-json-structure-mcp-binding.md).
That document defines the mechanics. This one argues the case.

## The schema is the whole conversation

A language model never sees your server. It sees three things: a tool name, a
description string, and a schema. That is the entire surface. Everything the
model believes about what your tool wants and what it hands back is inferred
from those three fields, and two of them are short.

So look at what a typical MCP tool schema actually says today:

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

JSON Structure's answer is to put the meaning in the schema, structured, where
both the client and the model can get at it.

## Four things the annotation model adds

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
see both, which is precisely the pairing it needs in order to emit the code
and talk about the meaning.

None of this is exotic. It is the ordinary situation of any tool that fronts a
system somebody else built. Today it lands in the description string as a
sentence beginning "note that".

### 2. Units, currencies, and the numbers that carry them

This is the one I would fix first.

```json
"waterLevel": { "type": "double", "unit": "m", "ucumUnit": "m" },
"fee":        { "type": "decimal", "precision": 12, "scale": 2,
                "currency": "EUR" }
```

A `double` tells the model that the value is a number. `unit: "m"` tells it
the value is metres. Those are not the same fact, and the gap between them is
where a certain class of expensive mistake lives. Interfaces that agree on the
number and disagree on the unit have a long and well-documented history of
going badly, and we are now wiring these interfaces together with a component
that infers rather than knows.

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

Money gets the same treatment plus something JSON Schema simply cannot
express. Core represents `decimal` as a JSON string, with `precision` and
`scale` declared. So an invoice total travels as `"1234.56"` and arrives as
`1234.56`, not as whatever IEEE 754 decided that afternoon. Add `currency:
"EUR"` and the amount stops being a bare number that the model has to
associate with a currency mentioned four turns ago.

If your tool touches money and you are shipping it as `{"type": "number"}`,
this alone is worth the migration.

### 3. What the value means, not just what it is

Units tell you the dimension. Semantic annotations tell you the thing.

```json
"waterLevel": {
  "type": "double",
  "unit": "m",
  "semanticRole": "observationValue",
  "statistic": "mean",
  "supportPeriod": { "duration": "PT10M", "anchor": "end" },
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

- `coordinateReferenceSystem` binds a pair of properties into a coordinate and
  says which CRS it is in. A latitude and longitude without a CRS is a pair of
  numbers with a strong suggestion attached.
- `temporalReferenceSystem` and `cadence` say what a timestamp is measured
  against and how often to expect the next one.
- `codedValues` binds a coded property to an external code list, so a `status`
  of `4` resolves to something instead of inviting a guess.
- `observedProperty` says what was actually measured, by reference, which is
  the single most useful thing you can tell a model about a sensor reading.

The point of `concepts` in particular is that it hands the model a hook into
knowledge it already has. Naming a SOSA or QUDT or schema.org term is cheaper
than explaining the concept in prose and considerably more precise.

### 4. Which output field goes into which tool next

Here is the failure mode nobody writes down.

Tool A returns `{"authorId": "8c1f...", "title": "..."}`. Tool B takes
`{"id": "..."}`. The model has to work out that A's `authorId` is a valid
argument for B's `id`, and that A's `title` is not. It usually gets this
right. When it gets it wrong, it makes a call that succeeds, returns the wrong
record, and nothing anywhere raises an error.

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
that this field points at that type, and how many of them. Suddenly the
connections between your tools are declared rather than inferred, and a client
can do something with them: pre-validate a chained call, offer the model a
concrete next step, refuse a call that wires an author identity into a book
lookup.

For a single tool this is a nicety. For an agent loop running twenty tools
across four servers, it is the difference between a call graph and a pile of
functions.

## What you actually get

Fewer retry turns, because the model has the facts up front instead of
discovering them from a validation error.

Fewer silently wrong calls, which is the category that matters, because the
retry turns at least announce themselves.

Description strings that can go back to describing behavior. Every sentence
you currently spend on "amounts are in euro cents" and "timestamps are UTC"
and "pass the id from search_books here" is a sentence the schema can carry
structurally, once, in a form the client can act on.

Work moved out of the model and into the client, where it belongs. Unit
conversion, localization, form rendering, enum labelling, argument validation
before the call goes out — all of it is deterministic code operating on
declared facts. None of it should be an inference.

And a real type system underneath all of it. Sized integers, decimals that
survive the round trip, discriminated unions that are actually discriminated,
`map` and `set` and `tuple` as first-class types rather than three different
conventions layered on `object` and `array`.

## What you do not get

I would rather say this here than have you find it later.

Annotations are claims. A `unit` of `m` does not make a value metres, and a
`concepts` entry does not make the value an instance of that concept. This
raises the ceiling for a server that is trying to be correct. It does nothing
about a server that is wrong or hostile, and the binding spec is blunt about
that in its security considerations.

There is no graceful degradation. A JSON Structure schema is not readable as
JSON Schema — `$ref` sits in a different place, half the types are unknown,
and `int64` is a string. A client that does not implement the binding must
refuse the schema rather than misread it. The binding defines companion
carriage in `_meta` precisely so that you can serve both populations, and it
costs you the bytes of two schemas.

Relations has no `$uses` identifier yet. The keywords work, and Core permits
unknown keywords, so they travel and a knowing client can read them. But they
are not gated by a published add-in at the time of writing, which means no
meta-schema validates them.

Semantic annotations have no registry. The `kind` values are open by design
and a future revision is expected to establish a registry. Until then, two
servers can name the same vocabulary differently and nothing will catch it.

Client support has to be built. This is the honest bottleneck. The binding is
small on purpose — it is one keyword's worth of dialect selection plus a set
of rules about what may appear — but somebody has to write the validator and
the annotation-aware rendering, and until they do, companion carriage is how
you ship.

## Where to start

Pick one tool. Preferably one with a unit, a currency, or an identifier that
another tool consumes, because that is where the payoff is visible.

Point its `inputSchema` at
`https://json-structure.org/meta/extended/v0/#`, add
`"$uses": ["JSONStructureUnits", "JSONStructureValidation"]`, and annotate the
two or three properties that were carrying meaning in the description string.
Keep companion carriage on while your clients catch up.

Then read the binding spec for the rules, particularly the ones about
self-containment and extension activation. The second of those is the one
people get wrong: an add-in keyword you forget to activate is ignored, not
rejected, and a schema that silently enforces nothing is worse than one that
never claimed to.

---

title: "JSON Structure: Model Context Protocol Binding"
abbrev: "JSON Structure MCP Binding"
category: std

docname: draft-vasters-json-structure-mcp-binding-latest
submissiontype: IETF  # also: "independent", "editorial", "IAB", or "IRTF"
number:
date: 2026-08-13
consensus: true
v: 3
area: Web and Internet Transport
workgroup: Building Blocks for HTTP APIs
keyword: Internet-Draft
venue:
  group: TBD
  type: Working Group
  mail: TBD
  arch: TBD
  github: "json-structure/mcp-binding"
  latest: "https://json-structure.github.io/mcp-binding/draft-vasters-json-structure-mcp-binding.html"

author:
 -
    fullname: Clemens Vasters
    organization: Microsoft Corporation
    email: clemensv@microsoft.com

normative:
  RFC2119:
  RFC3986:
  RFC6901:
  RFC8174:
  RFC8259:
  MCP:
    title: "Model Context Protocol Specification, Version 2025-11-25"
    author:
    - org: Model Context Protocol Contributors
    date: 2025
    target: https://modelcontextprotocol.io/specification/2025-11-25
  JSONRPC:
    title: "JSON-RPC 2.0 Specification"
    author:
    - org: JSON-RPC Working Group
    date: 2013
    target: https://www.jsonrpc.org/specification
  JSTRUCT-CORE:
    title: "JSON Structure Core"
    author:
      - fullname: Clemens Vasters
    target: https://json-structure.github.io/core/draft-vasters-json-structure-core.html
  JSTRUCT-IMPORT:
    title: "JSON Structure Import"
    author:
      - fullname: Clemens Vasters
    target: https://json-structure.github.io/import/draft-vasters-json-structure-import.html
  JSTRUCT-UNITS:
    title: "JSON Structure: Symbols, Scientific Units, and Currencies"
    author:
      - fullname: Clemens Vasters
    target: https://json-structure.github.io/units/draft-vasters-json-structure-units.html
  JSTRUCT-VALIDATION:
    title: "JSON Structure Validation"
    author:
      - fullname: Clemens Vasters
    target: https://json-structure.github.io/validation/draft-vasters-json-structure-validation.html
  JSTRUCT-COMPOSITION:
    title: "JSON Structure Conditional Composition"
    author:
      - fullname: Clemens Vasters
    target: https://json-structure.github.io/conditional-composition/draft-vasters-json-structure-cond-composition.html
  JSTRUCT-ALTNAMES:
    title: "JSON Structure Alternate Names"
    author:
      - fullname: Clemens Vasters
    target: https://json-structure.github.io/alternate-names/draft-vasters-json-structure-alternate-names.html

informative:
  JSTRUCT-SEMANN:
    title: "JSON Structure Semantic Annotations"
    author:
      - fullname: Clemens Vasters
    target: https://json-structure.github.io/semantic-annotations/draft-vasters-json-structure-sem-ann.html
  JSTRUCT-RELATIONS:
    title: "JSON Structure Relations"
    author:
      - fullname: Clemens Vasters
    target: https://json-structure.github.io/relations/draft-vasters-json-structure-relations.html
  JSON-SCHEMA:
    title: "JSON Schema: A Media Type for Describing JSON Documents, Draft 2020-12"
    author:
    - org: JSON Schema Organization
    date: 2020
    target: https://json-schema.org/draft/2020-12/schema

--- abstract

This document defines a binding that allows the schema slots of the Model
Context Protocol (MCP) {{MCP}} to carry JSON Structure {{JSTRUCT-CORE}}
schemas. It uses the dialect-selection mechanism MCP already provides: the
`$schema` keyword on a tool's `inputSchema` and `outputSchema` and on an
elicitation `requestedSchema`. For deployments that must also serve clients
that do not implement this binding, it defines a companion carriage in MCP's
`_meta` field. The binding is strictly additive and opt-in per schema slot.
It introduces no new MCP methods, capabilities, or message types, and it does
not modify, fork, or republish the Model Context Protocol.

--- middle

# Introduction {#introduction}

The Model Context Protocol {{MCP}} lets a server describe the tools it offers
to a language model. Each tool carries an `inputSchema` describing its
arguments, optionally an `outputSchema` describing the structured result, and
a server may ask the user for information with an elicitation
`requestedSchema`. All three are schema documents that travel inside a
JSON-RPC {{JSONRPC}} message.

MCP's own definition of these slots is deliberately thin. The wire type
constrains the root to `"type": "object"` with `properties` and `required`,
and leaves everything below the first level unconstrained. Protocol version
2025-11-25 added an optional `$schema` keyword to each slot and states that
the value defaults to JSON Schema 2020-12 {{JSON-SCHEMA}} when no explicit
`$schema` is given. That keyword is the seam this document uses, and it uses
nothing else.

The result is a strictly additive, opt-in binding:

* Adoption is per schema slot. One tool, several tools, or every tool on a
  server can use JSON Structure. The rest of the server is unaffected.
* No new MCP fields, methods, capabilities, or notifications are introduced.
  A JSON Structure schema appears in the slot where a schema is already
  expected.
* JSON Structure's precise type system, identifier-safe naming with wire-name
  aliases, unit and currency annotations, semantic annotations, and relation
  declarations become available to describe what a tool actually consumes and
  produces.

The motivation for doing this, and what a model and a client gain from the
annotation model in particular, is set out in a companion document, "Why JSON
Structure for MCP?", published alongside this specification. This document is
confined to the mechanics.

MCP {{MCP}} remains authoritative for everything this document does not
modify.

# Conventions and Terminology {#conventions-and-terminology}

{::boilerplate bcp14-tagged}

This document uses the following terms:

Schema slot:
: A location in an MCP message whose value is a schema document. This
  document binds three of them: `Tool.inputSchema`, `Tool.outputSchema`, and
  the `requestedSchema` member of the parameters of an `elicitation/create`
  request in form mode {{MCP}}.

Dialect, meta-schema:
: The URI, carried in `$schema`, that identifies the language and version a
  schema document is written in.

Bound slot:
: A schema slot whose content is a JSON Structure schema under this binding,
  by either of the two carriage profiles in {{carriage}}.

Argument object:
: The value of `params.arguments` in a `tools/call` request {{MCP}}.

Structured result:
: The value of `structuredContent` in a `CallToolResult` {{MCP}}.

Terms defined by JSON Structure Core {{JSTRUCT-CORE}}, such as schema
document, type, namespace, and add-in, are used as defined there. Terms
defined by MCP {{MCP}}, such as tool, client, server, host, elicitation, and
sampling, are used as defined there.

# Scope and Relationship to MCP {#scope}

This document does not change MCP. It defines how an existing MCP schema slot
is recognized as carrying JSON Structure, how its content is constrained, and
what a client and a server are obliged to do with it.

The following are explicitly out of scope:

* Changes to any MCP method, capability, notification, or transport.
* Changes to `CallToolResult.content`, the unstructured content list. This
  binding governs `structuredContent` only.
* Negotiation. A client does not announce support for this binding through an
  MCP capability, and a server does not ask for it. {{carriage}} defines a
  carriage profile that keeps unaware clients working without negotiation.
* The `ToolAnnotations` object and the `Icon` object. Those are MCP
  constructs and are unaffected.
* Any registry of semantic vocabularies, unit symbols, or concept
  identifiers. Those belong to the JSON Structure companion specifications.

A server MAY use this binding for some tools and MCP's default dialect for
others in the same `tools/list` result. A server MAY bind `inputSchema` and
leave `outputSchema` in the default dialect, or the reverse.

Tools offered to a client for use during sampling, in the `tools` member of
`sampling/createMessage` parameters {{MCP}}, are `Tool` objects and are bound
by this document on the same terms as tools offered through `tools/list`.

# Dialect Selection {#dialect-selection}

## Recognized Meta-Schema URIs {#meta-schema-uris}

A schema slot is a JSON Structure schema under this binding when its
`$schema` member is present and its value is one of the following URIs:

| URI | Meaning |
|---|---|
| `https://json-structure.org/meta/core/v0/#` | Core {{JSTRUCT-CORE}} only. No add-ins. |
| `https://json-structure.org/meta/extended/v0/#` | Core plus the add-ins that meta-schema offers, each of which must be activated with `$uses`. |
| `https://json-structure.org/meta/validation/v0/#` | Core with all offered add-ins activated by default. |
| `https://json-structure.org/meta/semantic-annotations/v0/#` | Core plus the semantic annotation add-in {{JSTRUCT-SEMANN}}, which must be activated with `$uses`. |

The list is not closed. A future JSON Structure meta-schema URI, or a private
meta-schema that itself references one of the above, is recognized under this
binding if the processor knows it. A processor that does not know a `$schema`
value MUST apply {{unknown-dialects}}.

A bound slot MUST carry `$schema` explicitly. A server MUST NOT emit a JSON
Structure schema in a slot with `$schema` absent. MCP defines an absent
`$schema` to mean JSON Schema 2020-12, and a JSON Structure schema read as
JSON Schema is not merely imprecise, it is wrong: `$ref` sits in a different
position, `map`, `set`, `tuple`, `choice`, and `any` are unknown types, and
`int64` and `decimal` values are strings rather than numbers.

## Unknown and Mismatched Dialects {#unknown-dialects}

A client that encounters a `$schema` value it does not implement MUST NOT
process the schema under any other dialect, and in particular MUST NOT
process it as JSON Schema. The client MUST take one of the following
actions:

* Treat the tool as having an undescribed argument object and an undescribed
  result, and offer it to the model only if the host permits tools with
  undescribed arguments; or
* Omit the tool from the set presented to the model.

Silent reinterpretation is prohibited because the keyword spellings `type`,
`properties`, `required`, `description`, and `$ref` are shared across
dialects with differing semantics. A schema misread as another dialect
produces validation outcomes that differ without any error being raised.

A server MUST NOT rely on a client rejecting a schema safely. A server that
needs to remain useful to clients that do not implement this binding MUST use
the companion carriage profile in {{companion-carriage}}.

# Carriage Profiles {#carriage}

This binding defines two ways for a JSON Structure schema to reach a client.
A server MUST use exactly one of them per schema slot.

## Native Carriage {#native-carriage}

Under native carriage the JSON Structure schema document is the value of the
schema slot itself, and its root `$schema` member selects the dialect per
{{meta-schema-uris}}.

~~~ json
{
  "name": "convert_temperature",
  "title": "Convert Temperature",
  "inputSchema": {
    "$schema": "https://json-structure.org/meta/extended/v0/#",
    "$id": "https://tools.example.com/schemas/convert-temperature-input",
    "$uses": ["JSONStructureUnits", "JSONStructureValidation"],
    "name": "ConvertTemperatureInput",
    "type": "object",
    "properties": {
      "reading": { "type": "double", "unit": "Cel", "minimum": -273.15 },
      "target": { "type": "string", "enum": ["Cel", "K", "[degF]"] }
    },
    "required": ["reading", "target"]
  }
}
~~~

Native carriage requires the client to implement this binding. It is the
higher-fidelity profile and the one a server SHOULD prefer when it knows its
clients.

## Companion Carriage {#companion-carriage}

Under companion carriage the schema slot holds a schema in MCP's default
dialect, and the JSON Structure schema travels in the `_meta` field of the
enclosing object under a key defined by this document.

| Slot | `_meta` location | Key |
|---|---|---|
| `Tool.inputSchema` | `Tool._meta` | `org.json-structure/inputSchema` |
| `Tool.outputSchema` | `Tool._meta` | `org.json-structure/outputSchema` |
| `requestedSchema` | `params._meta` of the `elicitation/create` request | `org.json-structure/requestedSchema` |

The value under such a key MUST be a complete JSON Structure schema document
carrying its own `$schema` per {{meta-schema-uris}} and satisfying every
requirement of {{schema-requirements}}.

The two schemas describe the same argument object or structured result. The
JSON Structure schema is authoritative. A server MUST ensure that every
instance the JSON Structure schema accepts is also accepted by the schema in
the slot. The converse is not required, and generally will not hold: the slot
schema is expected to be the looser of the two, because MCP's default dialect
cannot express everything JSON Structure can.

A client that implements this binding SHOULD use the JSON Structure schema
and ignore the slot schema. A client that does not implement this binding
sees a slot schema in the dialect it already understands, and MCP's own
`_meta` rules require it to ignore keys it does not recognize.

When a slot carries a recognized JSON Structure `$schema` per
{{meta-schema-uris}}, the corresponding `_meta` key MUST NOT also be present.

# Schema Requirements {#schema-requirements}

A JSON Structure schema in a bound slot MUST be a valid schema document per
JSON Structure Core {{JSTRUCT-CORE}} and the add-ins it activates, subject to
the additional requirements in this section.

## Root Form {#root-form}

The root of the schema document MUST declare `"type": "object"` inline. This
satisfies MCP's requirement that a schema slot be an object type at the root.

Consequently:

* `$root` MUST NOT be present. Core makes `$root` and `type` mutually
  exclusive, and MCP requires `type`.
* The root MUST carry `name`, as Core requires for every `object` type. The
  value MUST match Core's identifier production. A server SHOULD derive it
  from the tool name, transformed as needed to satisfy that production.
* `$id` MUST be present, as Core requires. Its value MUST be an absolute URI
  {{RFC3986}} in a namespace the server controls. It identifies the schema;
  it is not a retrieval address, and a client MUST NOT dereference it. See
  {{security-considerations}}.
* `definitions` MAY be present and carries any types the root references.
* `$uses` MAY be present at the root, which is the only place it appears. See
  {{extension-activation}}.

## Zero-Argument Tools {#zero-argument-tools}

MCP requires the object form even for a tool that takes no arguments. JSON
Structure Core requires an `object` type to declare at least one property.

For the root of a bound `inputSchema` only, and only when the tool takes no
arguments, this binding relaxes that requirement: `properties` MAY be an
empty object. When it is, `additionalProperties` MUST be present with the
value `false`, and `required` MUST be absent or empty.

~~~ json
{
  "$schema": "https://json-structure.org/meta/core/v0/#",
  "$id": "https://tools.example.com/schemas/ping-input",
  "name": "PingInput",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
~~~

This relaxation does not extend to `outputSchema`, to `requestedSchema`, to
nested types, or to types in `definitions`. A tool that produces no
structured result omits `outputSchema` rather than declaring an empty one.

## Self-Containment {#self-containment}

A schema in a bound slot MUST be self-contained. Specifically:

* `$import` and `$importdefs` {{JSTRUCT-IMPORT}} MUST NOT appear. A server
  that composes its schemas from imported libraries MUST resolve those
  imports before transmission, merging the imported definitions into
  `definitions` under the designated namespace and rewriting JSON Pointers
  within the imported definitions as the Import specification requires.
* Every `$ref` MUST resolve within the same schema document, as Core already
  requires.
* No other member may carry a URI that a processor is expected to retrieve in
  order to interpret the schema.

The only URI in a bound slot that identifies something outside the document
is `$schema`, and it is matched against the table in {{meta-schema-uris}}
rather than fetched.

The reason is the setting. A schema slot travels inside a single JSON-RPC
message that a client processes while listing tools, often before any trust
decision about the server has been made. A schema that is only interpretable
after a network fetch turns tool discovery into a request-forgery surface.

## Extension Activation {#extension-activation}

Add-in keywords are inert unless activated. A schema document activates
add-ins with `$uses` at its root, naming add-ins offered by the meta-schema
its `$schema` selects, except where the meta-schema activates them by
default.

The following identifiers are defined by the JSON Structure meta-schemas at
the time of writing:

* `JSONStructureAlternateNames` {{JSTRUCT-ALTNAMES}}
* `JSONStructureUnits` {{JSTRUCT-UNITS}}
* `JSONStructureImport` {{JSTRUCT-IMPORT}}, which {{self-containment}}
  prohibits in a bound slot
* `JSONStructureConditionalComposition` {{JSTRUCT-COMPOSITION}}
* `JSONStructureValidation` {{JSTRUCT-VALIDATION}}
* `JSONStructureSemanticAnnotations` {{JSTRUCT-SEMANN}}, offered by the
  semantic annotations meta-schema

If a schema in a bound slot uses a keyword defined by one of these add-ins,
it MUST activate that add-in, either by naming it in `$uses` or by selecting
a meta-schema that activates it by default. A server MUST NOT emit a bound
slot containing an unactivated add-in keyword.

This requirement exists because the failure is silent. An unactivated add-in
keyword is ignored rather than rejected. A schema that carries `minimum` and
`maxLength` without activating `JSONStructureValidation` describes
constraints that no validator will enforce, and it does so while looking
entirely reasonable to a reader.

A client that finds an unactivated add-in keyword MUST treat the instance as
unconstrained by that keyword. It SHOULD report the condition through
whatever diagnostic channel it has, and it MAY treat the schema as
malformed.

Relation keywords {{JSTRUCT-RELATIONS}}, namely `identity`, `relations`,
`targettype`, `cardinality`, `scope`, and `qualifiertype`, have no add-in
identifier defined at the time of writing. They are carried in a bound slot
as unknown keywords, which Core permits, and a processor that does not
understand them MUST preserve and ignore them.

# Names on the Wire {#wire-names}

JSON Structure requires property names to match the identifier production
`[A-Za-z_][A-Za-z0-9_]*`. MCP places no such restriction on argument keys or
on members of a structured result. The Alternate Names add-in
{{JSTRUCT-ALTNAMES}} bridges the two with the reserved `json` purpose
indicator of `altnames`.

The key that identifies a property on the wire, in the argument object of a
`tools/call` request and in a structured result, is:

1. the value of that property's `altnames` member under the key `json`, if
   present; otherwise
2. the property name itself.

A schema that uses `altnames` for this purpose MUST activate
`JSONStructureAlternateNames` per {{extension-activation}}.

~~~ json
{
  "name": "SearchInput",
  "type": "object",
  "properties": {
    "maxResults": {
      "type": "int32",
      "altnames": { "json": "max-results", "lang:en": "Maximum results" }
    }
  }
}
~~~

An instance of that type appears on the wire as `{"max-results": 20}`. Two
properties of the same type MUST NOT resolve to the same wire name.

Purpose indicators other than `json`, the `lang:` family in particular, do
not affect the wire form. They are display names, and {{annotations}}
describes what a client may do with them.

# Value Representation {#value-representation}

An argument object and a structured result are JSON {{RFC8259}} values, and
JSON Structure Core fixes how each of its types is represented in JSON.
Nothing in this binding changes that, but two consequences are worth stating
because they differ from what a JSON Schema-shaped intuition expects.

Numeric types whose range exceeds what IEEE 754 double precision represents
exactly, namely `int64`, `uint64`, `int128`, `uint128`, and `decimal`, are
represented as JSON strings. A `tools/call` request carrying an `int64`
argument sends `{"count": "9007199254740993"}`, not a JSON number. Servers
and clients MUST use the string form, MUST NOT coerce it to a JSON number,
and MUST NOT parse it into a binary floating-point value on the way through.

Values of the Core types `binary`, `date`, `datetime`, `time`, `duration`,
`uuid`, `uri`, and `jsonpointer` are represented as JSON strings in the forms
Core prescribes.

A server MUST reject an argument object that presents a value in the wrong
representation. A lenient server that accepts `9007199254740993` as a JSON
number for an `int64` property teaches the model a shape that the next
implementation will reject.

# Validation {#validation}

## Server Obligations {#server-validation}

A server MUST validate the argument object of a `tools/call` request against
the bound `inputSchema` before executing the tool. Validation is performed
per JSON Structure Core {{JSTRUCT-CORE}} together with the add-ins the schema
activates.

If validation fails the server MUST NOT execute the tool, and it MUST report
the failure in one of two ways:

* as a JSON-RPC error {{JSONRPC}} with code `-32602`, which is what MCP
  prescribes for invalid arguments; or
* as a `CallToolResult` with `isError` set to `true` and a diagnostic in
  `content`, when the server judges that the model should see the failure and
  correct itself.

A diagnostic SHOULD identify each failing location with a JSON Pointer
{{RFC6901}} into the argument object, and SHOULD name the keyword that
failed.

When a bound `outputSchema` is present, MCP already requires the server to
produce a `structuredContent` value that conforms to it. Under this binding,
conformance means validity per JSON Structure Core and the activated add-ins.
A server MUST NOT return a structured result that does not validate; it
returns an error result instead.

MCP recommends that a tool returning structured content also serialize it
into a text content block for clients that predate `structuredContent`. When
a server does so, the text block MUST contain the JSON serialization
{{RFC8259}} of the same value that appears in `structuredContent`.

## Client Obligations {#client-validation}

A client that implements this binding SHOULD validate a structured result
against the bound `outputSchema` before presenting it to the model.

A client MUST NOT present a non-conforming structured result to the model as
though it conformed. It MAY present the result with the discrepancy
described, and it MAY discard the structured result and fall back to the
unstructured `content` list.

A client MAY validate an argument object against the bound `inputSchema`
before sending it. Doing so catches model errors a turn earlier and is
RECOMMENDED where the cost is acceptable. It does not relieve the server of
{{server-validation}}.

# Elicitation {#elicitation}

MCP's `requestedSchema` for form-mode elicitation is a deliberately narrow
profile: top-level properties only, no nesting, and a restricted set of
primitive shapes. That narrowness is a client rendering concern, not an
expressiveness preference, and this binding preserves it.

A bound `requestedSchema` MUST satisfy {{schema-requirements}} and the
following additional constraints:

* The root MUST declare at least one property. {{zero-argument-tools}} does
  not apply.
* `definitions` MUST NOT be present, and `$ref` MUST NOT be used.
* Every property MUST declare one of the following as its `type`: `string`,
  `boolean`, `number`, `integer`, `int8`, `uint8`, `int16`, `uint16`,
  `int32`, `uint32`, `float`, `double`, `date`, `datetime`, or `uri`.
* A property MAY declare `enum` alongside a `string` type, giving a
  single-selection field.
* A property MAY declare `type` as `array` or `set` whose `items` is an
  `enum`-constrained `string`, giving a multiple-selection field. This is the
  only compound type permitted.
* No other compound type, meaning `object`, `map`, `tuple`, or `choice`, may
  appear.

A client renders the form from the schema. The following mappings are
RECOMMENDED:

* `description`, or a `descriptions` entry matching the user's language, is
  the field's help text.
* An `altnames` entry with a `lang:` purpose indicator matching the user's
  language is the field's label. Otherwise the property name is the label.
* `altenums` entries under a matching `lang:` indicator are the display
  labels of the selectable values.
* `unit`, `currency`, or `symbol` {{JSTRUCT-UNITS}} is displayed adjacent to
  the input.
* Validation keywords {{JSTRUCT-VALIDATION}} constrain the input in the form.

The value the client returns in `ElicitResult.content` MUST use the wire
names defined in {{wire-names}} and the representations required by
{{value-representation}}.

# Annotations and Client Behavior {#annotations}

Everything in this section is advisory. A client MAY ignore all of it and
still conform.

A bound schema may carry annotations that describe the data beyond its shape.
A client that implements this binding is in a position to use them, in two
distinct ways, and the distinction matters.

## Surfacing to the User {#annotations-user}

A client MAY use `altnames` with `lang:` indicators, `descriptions`,
`altenums`, `symbol`, `symbols`, `unit`, `currency`, and `examples` to render
argument forms, confirmation prompts, and result displays. This is
presentation, and it is the low-risk use.

## Surfacing to the Model {#annotations-model}

A client MAY incorporate schema annotations into the material it places in
the model's context: the tool description, a rendering of the argument
schema, or a rendering of the result schema.

Annotations that carry machine-checkable identity are the useful ones here.
`unit` and `ucumUnit` state the physical unit of a quantity, `currency`
states the currency of a monetary amount, `concepts` and the other semantic
annotation keywords {{JSTRUCT-SEMANN}} bind a value to an external
vocabulary, and the relation keywords {{JSTRUCT-RELATIONS}} state which
member of a result is an identity that another tool accepts as an argument. A
model that is told a value is in `Cel` and a model that is told a value is a
`double` are not equally equipped.

Annotations that carry free text are a different matter. `description`,
`descriptions`, and the `lang:` entries of `altnames` are natural language
authored by the server operator, and placing them in the model's context is
placing server-controlled text in the model's context. A client MUST treat
them with the same suspicion MCP already requires for `description` and
`ToolAnnotations`. See {{security-considerations}}.

A client MUST NOT make a tool-invocation or permission decision on the basis
of any schema annotation received from a server that the host does not trust.
Annotations describe data. They are not assertions about behavior, and a
server that wishes to lie in them is free to.

# Examples {#examples}

## A Tool with Units and an Identity {#example-tool}

A tool that reads a tide gauge. The input takes a station identifier; the
output carries a measured water level with its unit, a timestamp, and a
station reference that declares its own identity.

~~~ json
{
  "name": "read_tide_gauge",
  "title": "Read Tide Gauge",
  "description": "Return the most recent water level from a tide gauge.",
  "inputSchema": {
    "$schema": "https://json-structure.org/meta/extended/v0/#",
    "$id": "https://tides.example.com/schemas/read-gauge-input",
    "$uses": ["JSONStructureAlternateNames", "JSONStructureValidation"],
    "name": "ReadTideGaugeInput",
    "type": "object",
    "properties": {
      "stationId": {
        "type": "string",
        "description": "Identifier of the tide gauge station.",
        "altnames": { "json": "station-id", "lang:en": "Station" },
        "pattern": "^[0-9]{7}$"
      }
    },
    "required": ["stationId"]
  },
  "outputSchema": {
    "$schema": "https://json-structure.org/meta/extended/v0/#",
    "$id": "https://tides.example.com/schemas/read-gauge-output",
    "$uses": ["JSONStructureAlternateNames", "JSONStructureUnits"],
    "name": "ReadTideGaugeOutput",
    "type": "object",
    "properties": {
      "waterLevel": {
        "type": "double",
        "description": "Water surface height above chart datum.",
        "unit": "m",
        "ucumUnit": "m",
        "altnames": { "json": "water-level" }
      },
      "observedAt": {
        "type": "datetime",
        "altnames": { "json": "observed-at" }
      },
      "station": {
        "type": { "$ref": "#/definitions/StationRef" }
      }
    },
    "required": ["waterLevel", "observedAt", "station"],
    "definitions": {
      "StationRef": {
        "name": "StationRef",
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" }
        },
        "required": ["id", "name"],
        "identity": ["id"]
      }
    }
  }
}
~~~

A conforming `tools/call` request and result:

~~~ json
{
  "jsonrpc": "2.0", "id": 7, "method": "tools/call",
  "params": {
    "name": "read_tide_gauge",
    "arguments": { "station-id": "9414290" }
  }
}
~~~

~~~ json
{
  "jsonrpc": "2.0", "id": 7,
  "result": {
    "content": [
      { "type": "text",
        "text": "{\"water-level\":2.41,\"observed-at\":\"2026-08-13T09:00:00Z\",\"station\":{\"id\":\"9414290\",\"name\":\"San Francisco\"}}" }
    ],
    "structuredContent": {
      "water-level": 2.41,
      "observed-at": "2026-08-13T09:00:00Z",
      "station": { "id": "9414290", "name": "San Francisco" }
    }
  }
}
~~~

## Companion Carriage {#example-companion}

The same input schema, served to a mixed client population. The slot holds a
JSON Schema; `_meta` holds the authority.

~~~ json
{
  "name": "read_tide_gauge",
  "inputSchema": {
    "type": "object",
    "properties": {
      "station-id": { "type": "string", "pattern": "^[0-9]{7}$" }
    },
    "required": ["station-id"]
  },
  "_meta": {
    "org.json-structure/inputSchema": {
      "$schema": "https://json-structure.org/meta/extended/v0/#",
      "$id": "https://tides.example.com/schemas/read-gauge-input",
      "$uses": ["JSONStructureAlternateNames", "JSONStructureValidation"],
      "name": "ReadTideGaugeInput",
      "type": "object",
      "properties": {
        "stationId": {
          "type": "string",
          "altnames": { "json": "station-id" },
          "pattern": "^[0-9]{7}$"
        }
      },
      "required": ["stationId"]
    }
  }
}
~~~

Note that the slot schema uses the wire name, because that is what an unaware
client will send.

# Conformance {#conformance}

A conforming server under this binding:

* emits, in every bound slot, a schema document that satisfies
  {{schema-requirements}};
* uses exactly one carriage profile per slot, per {{carriage}};
* activates every add-in whose keywords it uses, per
  {{extension-activation}};
* emits and accepts wire names per {{wire-names}} and value representations
  per {{value-representation}};
* validates every argument object before execution and every structured
  result before transmission, per {{server-validation}}.

A conforming client under this binding:

* recognizes the meta-schema URIs it implements and applies
  {{unknown-dialects}} to the rest;
* constructs argument objects using wire names per {{wire-names}} and value
  representations per {{value-representation}};
* does not present a non-conforming structured result as conforming, per
  {{client-validation}};
* does not dereference `$id`, or any URI appearing in a semantic annotation,
  as a consequence of processing a schema.

Neither role is required to implement any particular add-in. A processor that
implements Core only, encounters an activated add-in it does not implement,
and cannot therefore enforce that add-in's constraints, MUST apply
{{unknown-dialects}} rather than proceeding with partial enforcement.

# Security Considerations {#security-considerations}

The security considerations of MCP {{MCP}} and of JSON Structure Core
{{JSTRUCT-CORE}} apply in full. The following are specific to this binding.

Dialect confusion:
: JSON Schema and JSON Structure share the keyword spellings `type`,
  `properties`, `required`, `description`, and `$ref` with differing
  semantics. A processor that misidentifies the dialect produces different
  validation outcomes with no error raised, so a schema that appears to
  constrain an argument may not constrain it at all. This is why
  {{unknown-dialects}} prohibits reinterpretation and why
  {{dialect-selection}} requires an explicit `$schema`.

Retrieval during discovery:
: Tool listing happens early, often before the host has made any trust
  decision about the server. A schema that requires a network fetch to
  interpret converts `tools/list` into a request-forgery primitive aimed at
  whatever the schema names, and leaks the fact and timing of tool discovery
  to a third party. {{self-containment}} forbids `$import` and external
  `$ref`. Clients MUST NOT dereference `$id`, and MUST NOT dereference the
  `reference` URIs in semantic annotations, as a consequence of processing a
  schema. Those URIs are identifiers; treat them as opaque strings.

Server-controlled text in the model's context:
: `description`, `descriptions`, and the `lang:` entries of `altnames` and
  `altenums` are free text chosen by the server operator, and
  {{annotations-model}} contemplates placing them in the model's context.
  That is an instruction-injection surface, identical in kind to the one MCP
  already identifies for `description` and `ToolAnnotations`. A client MUST
  treat all such text as untrusted content, MUST NOT act on instructions
  found in it, and MUST NOT make permission decisions on the basis of any
  schema annotation from an untrusted server.

Silently unenforced constraints:
: An add-in keyword that is not activated is ignored, not rejected. An
  attacker who can influence a schema, or a careless author, can produce a
  schema that reads as tightly constrained and enforces nothing.
  {{extension-activation}} makes activation mandatory for servers and makes
  the client's treatment explicit.

Resource consumption during schema processing:
: A schema arrives before any work is done and is processed by both parties.
  Implementations MUST bound the size of a schema document, the depth of
  nesting in `definitions`, the number and depth of `$ref` traversals, and
  the cardinality of `enum`. Implementations MUST detect reference cycles
  rather than recursing on them. A `pattern` value {{JSTRUCT-VALIDATION}} is
  an ECMA-262 regular expression from an untrusted source, so implementations
  MUST either use a matcher with non-exponential worst-case behavior or apply
  a time bound, or both.

Numeric precision as a correctness boundary:
: `int64`, `uint64`, `int128`, `uint128`, and `decimal` travel as strings
  precisely so that they survive the trip. An implementation that parses them
  into IEEE 754 doubles reintroduces the silent-rounding failure the type
  system was designed to prevent, and does so in a path where the values are
  frequently monetary. See {{value-representation}}.

Annotations are claims, not guarantees:
: A `unit` of `m` does not make a value metres, and a `concepts` entry naming
  a well-known ontology term does not make the value an instance of it.
  Annotations improve the odds that a correct server is understood correctly.
  They do nothing about an incorrect or hostile one, and a client MUST NOT
  treat them as evidence.

# IANA Considerations {#iana-considerations}

This document has no IANA actions.

The `_meta` keys defined in {{companion-carriage}} use the prefix
`org.json-structure/`, derived from a domain name under the control of the
JSON Structure project, per MCP's `_meta` key naming rules {{MCP}}. MCP
maintains no registry of `_meta` keys.

--- back

# Migrating a Tool Schema from JSON Schema {#migration}

The following table maps the constructs most commonly found in an MCP
`inputSchema` written as JSON Schema to their JSON Structure equivalents. It
is informative.

| JSON Schema | JSON Structure |
|---|---|
| `{"type":"object","properties":{...},"required":[...]}` | The same, plus a required `name`, plus root `$id` and `$schema`. |
| `{"type":"integer"}` | `{"type":"int32"}`. `integer` is accepted as an alias. |
| A 64-bit integer as `{"type":"integer"}` | `{"type":"int64"}`, represented as a JSON string. |
| `{"type":"number"}` for money | `{"type":"decimal","precision":n,"scale":m}` with `currency`, represented as a JSON string. |
| `{"type":"string","format":"date-time"}` | `{"type":"datetime"}`. |
| `{"type":"string","format":"uuid"}` | `{"type":"uuid"}`. |
| `{"type":"array","items":{"$ref":"#/$defs/X"}}` | `{"type":"array","items":{"type":{"$ref":"#/definitions/X"}}}`. `$ref` is the value of `type`, never a sibling of it. |
| `{"type":"object","additionalProperties":{...}}` used as a dictionary | `{"type":"map","values":{...}}`. |
| `{"type":"array","uniqueItems":true}` | `{"type":"set"}`. |
| `oneOf` used as a discriminated union | `{"type":"choice","choices":{...}}`, or `$extends` on an `abstract` base with a `selector`. |
| `oneOf`, `anyOf`, `allOf` used as constraints | The same keywords from Conditional Composition {{JSTRUCT-COMPOSITION}}, which are boolean combinators and do not merge type definitions. Each of `if`, `then`, and `else` must carry `type`. |
| `$defs` | `definitions`. |
| A property name that is not an identifier | An identifier property name plus `altnames` with a `json` entry carrying the wire name. |
| `minimum`, `maxLength`, `pattern`, and the rest | The same names from Validation {{JSTRUCT-VALIDATION}}, which must be activated with `$uses`. |
| `description` | `description`, optionally plus `descriptions` for other languages. |
| No equivalent | `unit`, `ucumUnit`, `currency` {{JSTRUCT-UNITS}}. |
| No equivalent | `concepts`, `semanticRole`, `observedProperty`, and the rest {{JSTRUCT-SEMANN}}. |
| No equivalent | `identity`, `relations`, `targettype`, `cardinality` {{JSTRUCT-RELATIONS}}. |

# Acknowledgments
{:numbered="false"}

Thanks to the Model Context Protocol maintainers and contributors, whose
decision to add an explicit `$schema` keyword to the tool schema slots in
protocol version 2025-11-25 is what makes a clean binding possible at all.

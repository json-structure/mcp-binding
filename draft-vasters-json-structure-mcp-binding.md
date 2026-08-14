---

title: "JSON Structure: Model Context Protocol Binding"
abbrev: "JSON Structure MCP Binding"
category: std
ipr: none

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
  RFC6901:
  RFC8174:
  RFC8259:
  MCP:
    title: "Model Context Protocol Specification, Version 2026-07-28"
    author:
    - org: Model Context Protocol Contributors
    date: 2026
    target: https://modelcontextprotocol.io/specification/2026-07-28
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
  JSTRUCT-VALIDATION:
    title: "JSON Structure Validation"
    author:
      - fullname: Clemens Vasters
    target: https://json-structure.github.io/validation/draft-vasters-json-structure-validation.html
  JSTRUCT-ALTNAMES:
    title: "JSON Structure Alternate Names"
    author:
      - fullname: Clemens Vasters
    target: https://json-structure.github.io/alternate-names/draft-vasters-json-structure-alternate-names.html

--- abstract

This document defines a binding that allows the schema slots of the Model
Context Protocol (MCP) {{MCP}} to carry JSON Structure {{JSTRUCT-CORE}}
schemas. It defines an MCP extension through which a client advertises that it
understands the dialect, selects the dialect with the `$schema` keyword MCP
already provides, and requires a server to fall back to JSON Schema for clients
that do not implement the extension. The binding is opt-in per schema slot and
introduces no new MCP methods or message types.

--- note_Copyright_Notice

Copyright (c) 2026 Microsoft Corporation. All rights reserved.

This is a pre-submission working draft, published for public review and
comment. It is not a standard, it does not represent a commitment by Microsoft
Corporation, and its content may change or be withdrawn at any time.

Permission is granted to read, reproduce, and redistribute this document in
unmodified form, in whole or in part, for the purpose of review and comment,
provided that this notice is retained. No other rights are granted, whether by
implication, estoppel, or otherwise, and no licence to any patent, trademark,
or other intellectual property right is granted by this document.

Microsoft Corporation intends to submit this document to a standards body. On
submission, the contribution and intellectual property policies of that body
govern this document and supersede this notice.

This document is provided "as is", without warranty of any kind.

--- middle

# Introduction {#introduction}

The Model Context Protocol {{MCP}} lets a server describe the tools it offers
to a language model. A tool carries an `inputSchema` for its arguments and
optionally an `outputSchema` for its structured result, and a server may ask
the user for information with a form-mode elicitation `requestedSchema`. All
three are schema documents that travel inside a JSON-RPC {{JSONRPC}} message.

MCP's definition of these slots is thin. The wire type constrains the root to
`"type": "object"` with `properties` and `required` and leaves everything
below the first level unconstrained. MCP's
[JSON Schema usage rules](https://modelcontextprotocol.io/specification/2026-07-28/basic/index#json-schema-usage)
permit a schema to name its dialect in `$schema` and default to JSON Schema
2020-12 when it is absent. This document uses that keyword and no other
extension point.

Adoption is per schema slot, and a server MAY bind one slot while leaving
another in the default dialect. The binding is an MCP extension
({{negotiation}}), so a client that does not implement it never receives a JSON
Structure schema and needs no changes. This document governs the three schema
slots and `structuredContent` and nothing else in MCP, which remains
authoritative for everything not modified here.

# Conventions and Terminology {#conventions-and-terminology}

{::boilerplate bcp14-tagged}

Schema slot:
: A location in an MCP message whose value is a schema document. This
  document binds three: `Tool.inputSchema`, `Tool.outputSchema`, and the
  `requestedSchema` of a form-mode `elicitation/create` request {{MCP}}.

Bound slot:
: A schema slot whose value is a JSON Structure schema under this binding.

Terms defined by JSON Structure Core {{JSTRUCT-CORE}} and by MCP {{MCP}} are
used as defined there. Argument object and structured result mean the values
of `params.arguments` in a `tools/call` request and of `structuredContent` in
a `CallToolResult`.

# Dialect Selection {#dialect-selection}

## Recognized Meta-Schema URIs {#meta-schema-uris}

A schema slot is a JSON Structure schema under this binding when its
`$schema` member is present and its value is one of the following URIs:

| URI | Meaning |
|---|---|
| `https://json-structure.org/meta/core/v0/#` | Core {{JSTRUCT-CORE}} only. No add-ins. |
| `https://json-structure.org/meta/extended/v0/#` | Core plus the add-ins that meta-schema offers, each of which must be activated with `$uses`. |
| `https://json-structure.org/meta/validation/v0/#` | Core with all offered add-ins activated by default. |
| `https://json-structure.org/meta/semantic-annotations/v0/#` | Core plus the semantic annotation add-in, which must be activated with `$uses`. |

The list is not closed: a future JSON Structure meta-schema URI, or a private
meta-schema that itself references one of the above, is recognized if the
processor knows it. A processor that does not know a `$schema` value MUST
apply {{unknown-dialects}}.

A bound slot MUST carry `$schema` explicitly, and a server MUST NOT emit a
JSON Structure schema in a slot with `$schema` absent. MCP defines an absent
`$schema` to mean JSON Schema 2020-12, and a processor that reads a JSON
Structure schema as JSON Schema will misinterpret it.

## Unrecognized Dialects {#unknown-dialects}

A recognized `$schema` value is one the processor implements. Anything else is
governed by MCP's rule for
[unsupported dialects](https://modelcontextprotocol.io/specification/2026-07-28/basic/index#implementation-requirements),
and a client MUST NOT fall back to reading the document as JSON Schema. See
{{security-considerations}}.

# Extension Negotiation {#negotiation}

This binding is an MCP
[extension](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning#extension-negotiation)
with the identifier `org.json-structure/schema-binding`. A client that
implements it MUST advertise that identifier in the `extensions` map of its
client capabilities, and a server that implements it MUST advertise the same
identifier in the `extensions` map of its server capabilities. Its settings
object is empty in this revision, and a party MUST ignore members of it that it
does not recognize.

A server MUST NOT place a JSON Structure schema in a schema slot for a client
that has not advertised the identifier. Where the client has, the schema slot
holds the JSON Structure schema document itself, and its `$schema` member
selects the dialect per {{meta-schema-uris}}.

~~~ json
"inputSchema": {
  "$schema": "https://json-structure.org/meta/extended/v0/#",
  "$id": "https://tools.example.com/schemas/convert-temp-input",
  "$uses": ["JSONStructureValidation"],
  "name": "ConvertTemperatureInput",
  "type": "object",
  "properties": { "celsius": { "type": "double", "minimum": -273.15 } },
  "required": ["celsius"]
}
~~~

## Fallback {#fallback}

A server MUST remain usable by a client that has not advertised the identifier.
For such a client it MUST place in the schema slot a JSON Schema 2020-12
projection of the JSON Structure schema that governs the slot.

The projection MUST accept every instance the JSON Structure schema accepts. It
will ordinarily accept more, because Core draws distinctions JSON Schema cannot
express. The JSON Structure schema remains authoritative: a server validates
per {{validation}} against it and not against the projection, so a client that
checks an argument object against the projection MAY find the server rejects
what the projection allowed. This document does not define the mapping.

# Schema Requirements {#schema-requirements}

A JSON Structure schema in a bound slot MUST be a valid schema document per
JSON Structure Core {{JSTRUCT-CORE}} and the add-ins it activates, subject to
the requirements in this section.

## Root Form {#root-form}

The root of a bound `inputSchema` or `requestedSchema` MUST declare
`"type": "object"` inline, and `$root` MUST NOT be present, since Core makes
the two mutually exclusive. MCP requires those
[slots](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#tool)
to carry `"type": "object"` at the root; that is MCP's wire type rather than a
property of Core, whose `choice` and `map` types also produce JSON objects and
would otherwise qualify. The root of a bound `outputSchema` MAY declare any
Core type inline, or MAY designate one through `$root`, since MCP constrains
neither the keyword nor the type there. The `name` Core requires on the root
SHOULD be derived from the tool name, transformed as needed to satisfy Core's
identifier production. The `$id` Core requires MUST be in a namespace the
server controls; it identifies the schema, is not a retrieval address, and a
client MUST NOT dereference it. See {{security-considerations}}.

## Zero-Argument Tools {#zero-argument-tools}

MCP describes a tool that takes no arguments with an object schema carrying
`"additionalProperties": false` and no properties, while Core requires an
`object` type to declare at least one property. A bound `inputSchema` for such
a tool MUST declare `"additionalProperties": false` and exactly one property,
named `null` and of type `null`, which MUST NOT appear in `required`. An empty
`arguments` object then satisfies both specifications, and the property carries
no argument value. This convention applies to a bound `inputSchema` only; no
schema in another slot may use it to stand in for an empty property set.

## Self-Containment {#self-containment}

A schema in a bound slot MUST be self-contained. The Import add-in
{{JSTRUCT-IMPORT}} is not permitted: a schema MUST NOT name
`JSONStructureImport` in `$uses`, and `$import` and `$importdefs` MUST NOT
appear even where the selected meta-schema activates the add-in by default. A
server composing schemas from imported libraries MUST resolve those imports,
as {{JSTRUCT-IMPORT}} defines that operation, before transmission.

No member may carry a URI that a processor is expected to retrieve in order
to interpret the schema. MCP already
[forbids automatic dereferencing](https://modelcontextprotocol.io/specification/2026-07-28/basic/index#ref-resolution)
of a `$ref` that resolves to a network URI; this binding admits no external
reference at all. The only outward-pointing URI in a bound slot is `$schema`,
matched against {{meta-schema-uris}} rather than fetched. See
{{security-considerations}}.

## Extension Activation {#extension-activation}

If a schema in a bound slot uses a keyword defined by an add-in, it MUST
activate that add-in, by naming it in `$uses` or by selecting a meta-schema
that activates it by default. A server MUST NOT emit a bound slot containing
an unactivated add-in keyword. A client that finds one MUST treat the
instance as unconstrained by that keyword, SHOULD report the condition, and
MAY treat the schema as malformed.

# Names on the Wire {#wire-names}

MCP places no restriction on the keys of an argument object or a structured
result, while Core constrains property names to its identifier production.
The reserved `json` purpose indicator of `altnames` {{JSTRUCT-ALTNAMES}}
reconciles the two: the key that identifies a property on the wire is the
value of that property's `altnames` member under the key `json` if present,
and the property name itself otherwise. A property named `maxResults` carrying
`"altnames": { "json": "max-results" }` therefore appears in an argument
object as `{"max-results": 20}`.

A schema that uses `altnames` for this purpose MUST activate
`JSONStructureAlternateNames` per {{extension-activation}}. Two properties of
the same type MUST NOT resolve to the same wire name. Purpose indicators
other than `json` do not affect the wire form.

# Value Representation {#value-representation}

An argument object and a structured result are JSON {{RFC8259}} values whose
representation is fixed by JSON Structure Core {{JSTRUCT-CORE}}. This binding
changes nothing about it and permits no leniency. Core represents the numeric
types that exceed exact IEEE 754 double precision as JSON strings, so a
`tools/call` request carrying an `int64` argument sends
`{"count": "9007199254740993"}`, not a JSON number. Servers and clients MUST
NOT coerce such a value to a JSON number, and MUST NOT parse it into a binary
floating-point value in transit, which would reintroduce the silent-rounding
failure the type system exists to prevent.

# Validation {#validation}

A server MUST validate the argument object of a `tools/call` request against
the bound `inputSchema`, per JSON Structure Core {{JSTRUCT-CORE}} and the
add-ins the schema activates, before executing the tool. If validation fails
the server MUST NOT execute the tool. MCP classifies input validation failure
as a [tool execution error](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#error-handling),
so the server SHOULD report it as a `CallToolResult` with `isError` set to
`true` and a diagnostic in `content`, which lets the model correct itself. A
server MAY instead return a JSON-RPC error {{JSONRPC}} with code `-32602`
where the request is malformed rather than merely invalid. A diagnostic
SHOULD identify each failing location with a JSON Pointer {{RFC6901}} into
the argument object and name the keyword that failed.

Where a bound `outputSchema` is present, MCP already requires the server to
produce a [conforming value](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#output-schema)
in `structuredContent`;
under this binding that means validity per Core and the activated add-ins. A
server MUST NOT return a structured result that does not validate, and
returns an error result instead. Where a server also mirrors the structured
result into a text content block, as MCP recommends for clients that predate
`structuredContent`, that block MUST contain the JSON serialization
{{RFC8259}} of the same value.

A client that implements this binding SHOULD validate a structured result
against the bound `outputSchema` before presenting it to the model, and MUST
NOT present a non-conforming result as though it conformed; it MAY describe
the discrepancy, or fall back to the unstructured `content` list. A client MAY
validate an argument object before sending it, which does not relieve the
server of its obligation.

# Elicitation {#elicitation}

MCP restricts `requestedSchema` for
[form-mode elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation#requested-schema)
to a narrow profile of top-level primitives, and this binding preserves it. A
bound `requestedSchema` MUST satisfy {{schema-requirements}} and, in
addition:

* The root MUST declare at least one property, and the convention of
  {{zero-argument-tools}} MUST NOT be used.
* `definitions` MUST NOT be present and `$ref` MUST NOT be used.
* Each property MUST declare as its `type` one of `string`, `boolean`,
  `number`, `integer`, `int8`, `uint8`, `int16`, `uint16`, `int32`, `uint32`,
  `float`, `double`, `date`, `datetime`, or `uri`; or `enum` alongside
  `string` for single selection; or `array` or `set` over an
  `enum`-constrained `string` for multiple selection. No other compound type.

The value returned in `ElicitResult.content` MUST use the wire names of
{{wire-names}} and the representations required by {{value-representation}}.

# Security Considerations {#security-considerations}

The security considerations of MCP {{MCP}} and of JSON Structure Core
{{JSTRUCT-CORE}} apply in full. The following are specific to this binding.

Dialect confusion:
: JSON Schema and JSON Structure share keyword spellings with differing
  semantics, so a processor that misidentifies the dialect validates
  differently with no error raised. The server validates authoritatively per
  {{validation}}; the exposure is on the reading side, where a host or a model
  plans from a contract that was never enforced. Hence the explicit `$schema`
  of {{dialect-selection}}, the rule in {{unknown-dialects}}, and the
  {{negotiation}} requirement that keeps a JSON Structure schema away from a
  client that has not said it can identify one.

Retrieval during discovery:
: Tool listing happens early, often before the host has made any trust
  decision about the server. A schema that requires a network fetch to
  interpret turns `tools/list` into a request-forgery primitive and leaks the
  timing of tool discovery to a third party. {{self-containment}} forbids it,
  and clients MUST NOT dereference `$id`, or any other URI a schema carries,
  as a consequence of processing that schema.

Schema identity:
: `$id` identifies a schema and nothing authenticates it, so a server naming
  an `$id` outside its own namespace can make an unrelated schema look like
  one the client trusts. {{root-form}} confines it to a namespace the server
  controls; a client keying decisions on `$id` MUST scope them per server.

Server-controlled text reaching the model:
: MCP already identifies a tool `description` as an
  [instruction-injection surface](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#security-considerations).
  This binding widens it: every Core annotation keyword, and every annotation
  an activated add-in defines, carries free text the server operator chooses.
  A client MUST treat all of it as untrusted and MUST NOT base permission
  decisions on a schema annotation. Annotations describe data, not behavior.

Silently unenforced constraints:
: An unactivated add-in keyword is ignored, not rejected, so a schema can read
  as tightly constrained and enforce nothing. {{extension-activation}} makes
  activation mandatory for servers and the client's treatment explicit. A host
  presenting a schema as evidence of what a tool accepts MUST NOT rely on an
  unconfirmed keyword, nor on the weaker projection of {{fallback}}.

Resource consumption during schema processing:
: Both parties process a schema before any tool is invoked, and MCP already
  asks implementations to
  [bound the cost of composition keywords](https://modelcontextprotocol.io/specification/2026-07-28/basic/index#composition-keyword-resource-use).
  Implementations MUST bound schema size, nesting depth, `$ref` traversal,
  and `enum` cardinality, and MUST detect reference cycles rather than
  recursing on them. A `pattern` value {{JSTRUCT-VALIDATION}} is an ECMA-262
  regular expression from an untrusted source, so implementations MUST use a
  matcher with non-exponential worst-case behavior, apply a time bound, or
  both.

# IANA Considerations {#iana-considerations}

This document has no IANA actions. The extension identifier of
{{negotiation}} uses the prefix `org.json-structure`, derived from a domain
name under the control of the JSON Structure project, per MCP's
[key naming rules](https://modelcontextprotocol.io/specification/2026-07-28/basic/index#meta).
MCP maintains no registry of extension identifiers.

--- back

# Acknowledgments
{:numbered="false"}

Thanks to the Model Context Protocol maintainers, whose explicit `$schema`
keyword makes this binding possible without extending the protocol.

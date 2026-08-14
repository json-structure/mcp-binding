#!/usr/bin/env node
/**
 * Cascade Basin Water Operations — MCP server.
 *
 *   npm run jsonschema      # baseline dialect
 *   npm run jsonstructure   # annotated dialect
 *
 * Same tools, same handlers, same data. Only the schemas differ.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { handlers, type Mode } from "./tools.js";
import { jsonSchemaTools } from "./schemas-jsonschema.js";
import { jsonStructureTools } from "./schemas-jsonstructure.js";

function parseMode(argv: string[]): Mode {
  const arg = argv.find((a) => a.startsWith("--mode="));
  const value = arg?.split("=")[1] ?? process.env.SCHEMA_MODE ?? "jsonschema";
  if (value !== "jsonschema" && value !== "jsonstructure") {
    throw new Error(`--mode must be jsonschema or jsonstructure, got '${value}'`);
  }
  return value;
}

const mode = parseMode(process.argv.slice(2));
const tools = mode === "jsonstructure" ? jsonStructureTools : jsonSchemaTools;

const server = new Server(
  { name: `cascade-basin-${mode}`, version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const handler = handlers[request.params.name];
  if (!handler) {
    return {
      content: [{ type: "text", text: `Unknown tool '${request.params.name}'.` }],
      isError: true,
    };
  }
  return handler(request.params.arguments ?? {}, mode);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`cascade-basin MCP server ready [mode=${mode}, tools=${tools.length}]`);

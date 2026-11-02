/* global console, process */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

// Builds a throwaway plugin whose only part is a .mcp.json naming a server on this machine, the way this plugin's
// .mcp.json names Perillo's, and runs one `claude -p` turn from an empty folder with the plugin loaded by --plugin-dir.
// The server answers every request 401, as an MCP server does before sign-in, and this prints what reached it: each
// request's method, address, header names and body. The turn calls a model, so Claude Code must be signed in.
const scratch = realpathSync(mkdtempSync(path.join(os.tmpdir(), "claude-mcp-open-")));
const plugin = path.join(scratch, "plugin");
const cwd = path.join(scratch, "cwd");
mkdirSync(path.join(plugin, ".claude-plugin"), { recursive: true });
mkdirSync(cwd);
writeFileSync(path.join(plugin, ".claude-plugin/plugin.json"), JSON.stringify({ name: "mcp-open-probe", version: "0.0.1" }));

const seen = [];
const server = http.createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", () => {
    seen.push({ method: request.method, url: request.url, headerNames: Object.keys(request.headers).sort(), body: body ? JSON.parse(body) : null });
    response.writeHead(401, { "content-type": "application/json" });
    response.end('{"error":"unauthorized"}');
  });
});
server.listen(0, "127.0.0.1", () => {
  const { port } = server.address();
  writeFileSync(path.join(plugin, ".mcp.json"), JSON.stringify({ mcpServers: { probe: { type: "http", url: `http://127.0.0.1:${port}/mcp` } } }));
  const claude = spawn("claude", ["-p", "Reply with the single word ok.", "--plugin-dir", plugin, "--max-turns", "1"], { cwd, stdio: ["ignore", "pipe", "pipe"] });
  let answer = "";
  claude.stdout.on("data", (chunk) => { answer += chunk; });
  claude.on("close", (exitCode) => {
    server.close();
    const clean = JSON.parse(JSON.stringify(seen).replaceAll(`127.0.0.1:${port}`, "<server>").replaceAll(scratch, "<scratch>"));
    console.log(JSON.stringify({ exitCode, answer: answer.trim(), requests: clean }, null, 2));
    process.exit(0);
  });
});

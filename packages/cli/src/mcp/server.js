import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import { CLI_VERSION } from '../version.js';
import { inputFile, listTools } from './tools.js';

const DEFAULT_PROTOCOL = '2025-06-18';

const memoryStream = () => {
  const stream = { isTTY: false, data: '', write: (chunk) => ((stream.data += chunk), true) };
  return stream;
};

// The CLI writes its progress on stderr as one JSON event per line: each one goes to `onEvent` as it arrives.
const eventStream = (onEvent) => {
  let buffered = '';
  return {
    isTTY: false,
    write: (chunk) => {
      buffered += chunk;
      const lines = buffered.split('\n');
      buffered = lines.pop();
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event?.event === 'progress') onEvent(event);
        } catch {
          // Not an event: nothing to report.
        }
      }

      return true;
    },
  };
};

const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

/**
 * `link-loom mcp`: the CLI as a Model Context Protocol server over stdio (JSON-RPC, one message per line). Every tool
 * runs the same dispatcher as the command line, in agent mode, so an MCP client gets exactly the JSON an agent gets.
 * A `tools/call` that carries `_meta.progressToken` gets `notifications/progress` while it runs (0 to 100, with a
 * message such as "Installing dependencies: 512/1203 packages in place").
 */
export const serveMcp = async ({ cwd, stdin = process.stdin, stdout = process.stdout, env = process.env }) => {
  const { run } = await import('../main.js');

  // A long call (create installs dependencies) reports as it goes when the client asked for it with a progressToken.
  const notifyProgress = (progressToken) => (event) =>
    stdout.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/progress',
        params: { progressToken, progress: event.progress, total: event.total, message: event.message },
      })}\n`,
    );

  const callTool = async (name, input = {}, progressToken) => {
    const tool = listTools(cwd).find((candidate) => candidate.name === name);
    if (!tool) {
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }

    const file = inputFile(tool, input);
    const out = memoryStream();
    const code = await run([...tool.argv(input), ...(file ? ['--input', file] : []), '--json', '--cwd', cwd], {
      stdout: out,
      stderr: progressToken === undefined ? memoryStream() : eventStream(notifyProgress(progressToken)),
      stdin: { isTTY: false },
      env,
    }).finally(() => file && fs.rmSync(path.dirname(file), { recursive: true, force: true }));
    const text = out.data.trim();
    const structured = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })();

    return {
      content: [{ type: 'text', text }],
      ...(structured ? { structuredContent: structured } : {}),
      isError: code !== 0,
    };
  };

  const handle = async (message) => {
    const { id, method, params = {} } = message;
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: params.protocolVersion || DEFAULT_PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'link-loom', version: CLI_VERSION },
        },
      };
    }

    if (method === 'ping') {
      return { jsonrpc: '2.0', id, result: {} };
    }

    if (method === 'tools/list') {
      const tools = listTools(cwd).map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
      return { jsonrpc: '2.0', id, result: { tools } };
    }

    if (method === 'tools/call') {
      return { jsonrpc: '2.0', id, result: await callTool(params.name, params.arguments, params._meta?.progressToken) };
    }

    // Notifications (no id) need no answer.
    return id === undefined ? null : rpcError(id, -32601, `Method not found: ${method}`);
  };

  const lines = readline.createInterface({ input: stdin, crlfDelay: Infinity });
  const pending = [];
  for await (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      stdout.write(`${JSON.stringify(rpcError(null, -32700, 'Parse error'))}\n`);
      continue;
    }

    const answer = handle(message).then((response) => response && stdout.write(`${JSON.stringify(response)}\n`));
    pending.push(answer);
  }

  await Promise.all(pending);
};

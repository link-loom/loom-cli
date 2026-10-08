import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { makeTempDir, runCli } from './helpers.js';

const BIN = fileURLToPath(new URL('../bin/link-loom.js', import.meta.url));

/** An MCP client of the official SDK, connected to `link-loom mcp` running in `cwd`. */
const connect = async (cwd) => {
  const client = new Client({ name: 'loom-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [BIN, 'mcp'], cwd }));
  return client;
};

describe('link-loom mcp', () => {
  it('offers create tools outside a project, each with its generator schema', async () => {
    const client = await connect(makeTempDir());
    const { tools } = await client.listTools();
    await client.close();

    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['describe', 'schema', 'check', 'create_webapp']),
    );
    expect(tools.find((tool) => tool.name === 'create_webapp').inputSchema.properties).toHaveProperty('variant');
  }, 30000);

  it('offers the add tools of a project and runs them through the same dispatcher', async () => {
    const cwd = makeTempDir();
    await runCli(['create', 'webapp', '--name', 'Acme Workspace', '--no-install', '--json', '--cwd', cwd]);
    const client = await connect(`${cwd}/acme-workspace`);
    const { tools } = await client.listTools();
    const planned = await client.callTool({
      name: 'add_copy',
      arguments: { key: 'reports.lowStock', en: 'Low stock', es: 'Inventario bajo', dryRun: true },
    });
    const refused = await client.callTool({
      name: 'add_copy',
      arguments: { key: 'reports.lowStock', en: 'x', es: 'y' },
    });
    await client.close();

    expect(tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(['add_entity', 'add_page', 'brand']));
    expect(planned.isError).toBe(false);
    expect(planned.structuredContent.plan.modify.map((entry) => entry.path)).toEqual([
      'src/i18n/en.js',
      'src/i18n/es.js',
    ]);
    expect(refused.isError).toBe(true);
    expect(refused.structuredContent.errors[0].code).toBe('E_CONFIRMATION_REQUIRED');
  }, 30000);

  it('reports progress while a create runs, when the client asks for it, and leaves no input file behind', async () => {
    const leftovers = () => fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('link-loom-mcp-')).length;
    const before = leftovers();
    const client = await connect(makeTempDir());
    const events = [];
    const created = await client.callTool(
      { name: 'create_webapp', arguments: { name: 'Acme Workspace', install: false } },
      undefined,
      { onprogress: (event) => events.push(event) },
    );
    await client.close();

    expect(created.isError).toBe(false);
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.at(-1)).toMatchObject({ progress: 100, total: 100, message: 'Done' });
    expect(events.map((event) => event.progress)).toEqual(
      [...events.map((event) => event.progress)].sort((a, b) => a - b),
    );
    expect(leftovers()).toBe(before);
  }, 30000);
});

#!/usr/bin/env node
import { run } from '../src/main.js';

process.exitCode = await run(process.argv.slice(2));

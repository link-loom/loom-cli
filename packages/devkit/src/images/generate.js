import fs from 'node:fs';
import path from 'node:path';

import { composePrompt } from './manifest.js';

const CONCURRENCY = 4;

/**
 * Generates the given slots with `provider` and writes each PNG master to the manifest's `sourceDir` (kept out of
 * public/; `optimize` makes the served WebP). One slot failing does not stop the others.
 */
export const generateImages = async ({ root, manifest, slots, provider, onProgress = () => {} }) => {
  const queue = [...slots];
  const results = [];

  const worker = async () => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      const startedAt = Date.now();
      try {
        const { buffer, model } = await provider.generate({
          slot: entry.slot,
          prompt: composePrompt(manifest, entry),
          aspect: entry.aspect,
          model: entry.model || manifest.model,
          params: entry.params,
          removeBackground: Boolean(entry.removeBackground),
        });
        const file = path.join(manifest.sourceDir, entry.filename);
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), buffer);
        const result = { slot: entry.slot, ok: true, file, model, bytes: buffer.length, ms: Date.now() - startedAt };
        results.push(result);
        onProgress(result);
      } catch (error) {
        const result = { slot: entry.slot, ok: false, error: error.message };
        results.push(result);
        onProgress(result);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, slots.length) }, worker));
  return slots.map((entry) => results.find((result) => result.slot === entry.slot));
};

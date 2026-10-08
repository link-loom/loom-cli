import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createTokenizer } from './tokenizer.js';
import { modelDir } from './files.js';
import { modelStatus } from './install.js';

/**
 * The sentence encoder, when it is installed: `embed(text)` answers a unit vector (mean of the token states), so
 * the dot product of two of them is their cosine similarity. Null when the model is not in the cache: the CLI then
 * works with its rules alone, and never downloads anything by itself.
 */
export const loadEmbedder = async ({ env = process.env } = {}) => {
  if (!modelStatus(env).installed) {
    return null;
  }

  const dir = modelDir(env);
  const ort = await import(pathToFileURL(path.join(dir, 'ort.wasm.min.mjs')).href);
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = pathToFileURL(`${dir}${path.sep}`).href;
  const session = await ort.InferenceSession.create(
    new Uint8Array(fs.readFileSync(path.join(dir, 'model_quantized.onnx'))),
    {
      executionProviders: ['wasm'],
    },
  );
  const tokenizer = createTokenizer(JSON.parse(fs.readFileSync(path.join(dir, 'tokenizer.json'), 'utf8')));

  const embed = async (text) => {
    const ids = tokenizer.encode(text);
    const tensor = (values) => new ort.Tensor('int64', BigInt64Array.from(values.map(BigInt)), [1, values.length]);
    const output = await session.run({
      input_ids: tensor(ids),
      attention_mask: tensor(ids.map(() => 1)),
      token_type_ids: tensor(ids.map(() => 0)),
    });
    const hidden = output.last_hidden_state;
    const size = hidden.dims[2];
    const pooled = new Float32Array(size);
    for (let token = 0; token < ids.length; token += 1) {
      for (let dimension = 0; dimension < size; dimension += 1) {
        pooled[dimension] += hidden.data[token * size + dimension] / ids.length;
      }
    }

    const norm = Math.hypot(...pooled) || 1;
    return pooled.map((value) => value / norm);
  };

  return { embed };
};

export const similarity = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);

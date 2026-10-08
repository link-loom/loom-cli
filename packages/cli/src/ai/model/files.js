import os from 'node:os';
import path from 'node:path';

const MODEL_REVISION = '751bff37182d3f1213fa05d7196b954e230abad9';
const MODEL_URL = `https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/${MODEL_REVISION}`;
const RUNTIME_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist';

/**
 * The local model, pinned: the sentence encoder all-MiniLM-L6-v2 (int8) at a fixed Hugging Face revision, and the
 * onnxruntime-web WASM runtime at a fixed release. Each file is checked against its SHA-256 before it is used.
 * About 37 MB, downloaded once with `link-loom ai install`; nothing of it ships in the npm package.
 */
export const LOCAL_MODEL = Object.freeze({
  id: `all-MiniLM-L6-v2-${MODEL_REVISION.slice(0, 7)}`,
  files: Object.freeze([
    {
      name: 'model_quantized.onnx',
      url: `${MODEL_URL}/onnx/model_quantized.onnx`,
      bytes: 22972370,
      sha256: 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1',
    },
    {
      name: 'tokenizer.json',
      url: `${MODEL_URL}/tokenizer.json`,
      bytes: 711661,
      sha256: 'da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0',
    },
    {
      name: 'ort.wasm.min.mjs',
      url: `${RUNTIME_URL}/ort.wasm.min.mjs`,
      bytes: 50126,
      sha256: '219e6a1fc8a9938268d18efca3c91d310bd2f4a59bbd13744df5b2b7fc6cee3b',
    },
    {
      name: 'ort-wasm-simd-threaded.mjs',
      url: `${RUNTIME_URL}/ort-wasm-simd-threaded.mjs`,
      bytes: 24381,
      sha256: 'e13f7f94fc51b4ca72b12faeb1ee95f4ace6dfbc8939bc718aabdc0a27c4299b',
    },
    {
      name: 'ort-wasm-simd-threaded.wasm',
      url: `${RUNTIME_URL}/ort-wasm-simd-threaded.wasm`,
      bytes: 14239897,
      sha256: '3398c10d07d229bd91b364548e130e0e51a8e5704b88c7c083ebbeb78842dee2',
    },
  ]),
});

/** Where the model lives: $LINK_LOOM_CACHE, or ~/.cache/link-loom, under models/<id>. */
export const modelDir = (env = process.env) =>
  path.join(env.LINK_LOOM_CACHE || path.join(os.homedir(), '.cache', 'link-loom'), 'models', LOCAL_MODEL.id);

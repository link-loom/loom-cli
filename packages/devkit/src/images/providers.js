import { ERROR_CODES, LoomError } from '../errors.js';

export const DEFAULT_REPLICATE_MODEL = 'openai/gpt-image-2';
export const DEFAULT_GEMINI_MODEL = 'nano-banana-pro-preview';

const REPLICATE_API = 'https://api.replicate.com/v1';
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
const BACKGROUND_REMOVAL_MODEL = 'bria/remove-background';
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 90;
const MAX_THROTTLE_RETRIES = 8;

const pick = (supported, fallback, aspect, otherwise) =>
  supported.includes(aspect) ? aspect : fallback[aspect] || otherwise;

// Each model takes its own aspect ratios; the manifest's aspect is mapped to the closest one it accepts.
const ASPECTS = {
  imagen: (aspect) =>
    pick(
      ['1:1', '9:16', '16:9', '3:4', '4:3'],
      { '4:5': '3:4', '16:10': '16:9', '21:9': '16:9', '5:4': '4:3', '3:2': '4:3', '2:3': '3:4', '1.91:1': '16:9' },
      aspect,
      '1:1',
    ),
  nano: (aspect) =>
    pick(
      ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '5:4', '4:5', '3:2', '2:3'],
      { '16:10': '16:9', '1.91:1': '16:9' },
      aspect,
      '1:1',
    ),
  gpt: (aspect) =>
    pick(
      ['1:1', '3:2', '2:3'],
      {
        '4:5': '2:3',
        '4:3': '3:2',
        '3:4': '2:3',
        '16:9': '3:2',
        '16:10': '3:2',
        '21:9': '3:2',
        '9:16': '2:3',
        '1.91:1': '3:2',
      },
      aspect,
      '1:1',
    ),
  flux: (aspect) =>
    pick(
      ['21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '9:21'],
      { '16:10': '3:2', '1.91:1': '3:2' },
      aspect,
      '1:1',
    ),
};

const imagen = ({ prompt, aspect }) => ({
  prompt,
  aspect_ratio: ASPECTS.imagen(aspect),
  output_format: 'png',
  safety_filter_level: 'block_medium_and_above',
});
const nano = ({ prompt, aspect }) => ({ prompt, aspect_ratio: ASPECTS.nano(aspect), output_format: 'png' });
const gpt = ({ prompt, aspect, params }) => ({
  prompt,
  aspect_ratio: ASPECTS.gpt(aspect),
  quality: 'high',
  output_format: 'png',
  ...(params || {}),
});

/** The input each Replicate model expects. A model not listed here is refused instead of guessed. */
export const REPLICATE_ADAPTERS = Object.freeze({
  'google/imagen-4-ultra': imagen,
  'google/imagen-4': imagen,
  'google/nano-banana-pro': nano,
  'google/nano-banana-2': nano,
  'google/nano-banana': nano,
  'openai/gpt-image-2': gpt,
  'openai/gpt-image-1': gpt,
  'bytedance/seedream-4': ({ prompt, aspect }) => ({ prompt, aspect_ratio: aspect, size: 'regular' }),
  'black-forest-labs/flux-1.1-pro-ultra': ({ prompt, aspect }) => ({
    prompt,
    aspect_ratio: ASPECTS.flux(aspect),
    raw: true,
    output_format: 'png',
    safety_tolerance: 2,
  }),
});

const fetchFailed = (slot, message) => new LoomError(ERROR_CODES.fetch, `[${slot}] ${message}`, { slot });

/** Starts a prediction, waiting out throttling the way Replicate asks (`retry_after`), then polls it to the end. */
const runPrediction = async ({ slot, model, input, token, fetchImpl, sleep }) => {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait=60' };
  let response;
  for (let attempt = 0; ; attempt += 1) {
    response = await fetchImpl(`${REPLICATE_API}/models/${model}/predictions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ input }),
    });
    if (response.status !== 429) {
      break;
    }

    if (attempt >= MAX_THROTTLE_RETRIES) {
      throw fetchFailed(slot, `Replicate kept throttling after ${MAX_THROTTLE_RETRIES} retries`);
    }

    const body = await response.json().catch(() => ({}));
    await sleep(((typeof body.retry_after === 'number' ? body.retry_after : 10) + 1) * 1000);
  }

  if (!response.ok) {
    throw fetchFailed(slot, `Replicate answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  let prediction = await response.json();
  for (let polls = 0; prediction.status === 'starting' || prediction.status === 'processing'; polls += 1) {
    if (polls >= MAX_POLLS) {
      throw fetchFailed(slot, 'Replicate did not finish in time');
    }

    await sleep(POLL_INTERVAL_MS);
    const poll = await fetchImpl(prediction.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    if (!poll.ok) {
      throw fetchFailed(slot, `Replicate poll answered ${poll.status}`);
    }

    prediction = await poll.json();
  }

  if (prediction.status !== 'succeeded') {
    throw fetchFailed(slot, `Replicate prediction ${prediction.status}: ${prediction.error || 'unknown error'}`);
  }

  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  const image = url ? await fetchImpl(url) : null;
  if (!image?.ok) {
    throw fetchFailed(slot, 'the generated image could not be downloaded');
  }

  return Buffer.from(await image.arrayBuffer());
};

const replicateProvider = ({ token, defaultModel, fetchImpl, sleep }) => ({
  name: 'replicate',
  model: defaultModel,
  generate: async ({ slot, prompt, aspect, model = defaultModel, params, removeBackground }) => {
    const adapter = REPLICATE_ADAPTERS[model];
    if (!adapter) {
      throw new LoomError(ERROR_CODES.validation, `[${slot}] no adapter for the Replicate model "${model}"`, {
        missing: [],
        problems: [{ field: 'model', message: `use one of ${Object.keys(REPLICATE_ADAPTERS).join(', ')}` }],
      });
    }

    const image = await runPrediction({
      slot,
      model,
      input: adapter({ prompt, aspect, params }),
      token,
      fetchImpl,
      sleep,
    });
    if (!removeBackground) {
      return { buffer: image, model };
    }

    const input = { image: `data:image/png;base64,${image.toString('base64')}` };
    return {
      buffer: await runPrediction({ slot, model: BACKGROUND_REMOVAL_MODEL, input, token, fetchImpl, sleep }),
      model,
    };
  },
});

const geminiProvider = ({ apiKey, model, fetchImpl }) => ({
  name: 'gemini',
  model,
  generate: async ({ slot, prompt }) => {
    const response = await fetchImpl(`${GEMINI_API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });
    if (!response.ok) {
      throw fetchFailed(slot, `Gemini answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }

    const json = await response.json();
    const part = (json?.candidates?.[0]?.content?.parts || []).find((candidate) => candidate?.inlineData?.data);
    if (!part) {
      throw fetchFailed(
        slot,
        `Gemini returned no image (${json?.promptFeedback?.blockReason || json?.candidates?.[0]?.finishReason || 'empty'})`,
      );
    }

    return { buffer: Buffer.from(part.inlineData.data, 'base64'), model };
  },
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The provider the keys allow: Replicate when REPLICATE_API_TOKEN is set (its model from REPLICATE_MODEL), Gemini
 * with GEMINI_API_KEY otherwise. `fetchImpl` and `sleep` are injectable so tests never reach the network.
 */
export const resolveImageProvider = ({ env, fetchImpl = globalThis.fetch, sleep = wait }) => {
  if (env.REPLICATE_API_TOKEN) {
    return replicateProvider({
      token: env.REPLICATE_API_TOKEN,
      defaultModel: env.REPLICATE_MODEL || DEFAULT_REPLICATE_MODEL,
      fetchImpl,
      sleep,
    });
  }

  if (env.GEMINI_API_KEY) {
    return geminiProvider({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_IMAGE_MODEL || DEFAULT_GEMINI_MODEL,
      fetchImpl,
    });
  }

  throw new LoomError(ERROR_CODES.usage, 'No image provider: set REPLICATE_API_TOKEN or GEMINI_API_KEY in .env.local', {
    next: ['REPLICATE_API_TOKEN=<token> link-loom services add image-generation --from-env --yes'],
  });
};

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  composePrompt,
  generateImages,
  optimizeImages,
  parseImageManifest,
  resolveImageProvider,
  selectSlots,
} from '../../src/index.js';

const MANIFEST = parseImageManifest(
  JSON.stringify({
    sourceDir: 'assets/img-source',
    outputDir: 'public/assets/img/photos',
    styles: { photo: 'Editorial photograph, natural light.', negative: 'No text, no logos.' },
    slots: [
      {
        slot: 'hero',
        filename: 'hero.png',
        aspect: '16:9',
        prompt: 'A bright warehouse.',
        styles: ['photo', 'negative'],
      },
      {
        slot: 'team',
        filename: 'people/team.png',
        aspect: '4:5',
        prompt: 'A team at work.',
        model: 'google/nano-banana-pro',
      },
    ],
  }),
);

const json = (body, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});
const png = () => ({ ok: true, status: 200, arrayBuffer: async () => Uint8Array.from([137, 80, 78, 71]).buffer });

describe('image manifest', () => {
  it('composes the prompt from the slot and the style blocks it names', () => {
    expect(composePrompt(MANIFEST, MANIFEST.slots[0])).toBe(
      'A bright warehouse.\n\nEditorial photograph, natural light.\n\nNo text, no logos.',
    );
  });

  it('runs named slots only, five at most', () => {
    expect(() => selectSlots(MANIFEST, [])).toThrow(expect.objectContaining({ code: 'E_USAGE' }));
    expect(() => selectSlots(MANIFEST, ['a', 'b', 'c', 'd', 'e', 'f'])).toThrow(/At most 5/);
    expect(() => selectSlots(MANIFEST, ['nope'])).toThrow(/Unknown slot/);
    expect(selectSlots(MANIFEST, ['team']).map((entry) => entry.slot)).toEqual(['team']);
  });

  it('rejects a manifest without the folders or with incomplete slots', () => {
    expect(() => parseImageManifest('{"slots": []}')).toThrow(/sourceDir/);
    expect(() => parseImageManifest('{"sourceDir":"a","outputDir":"b","slots":[{"slot":"x"}]}')).toThrow(/check x/);
  });
});

describe('image providers', () => {
  it('prefers Replicate, then Gemini, and explains how to add a key when there is none', () => {
    expect(resolveImageProvider({ env: { REPLICATE_API_TOKEN: 'r8', GEMINI_API_KEY: 'g' } }).name).toBe('replicate');
    expect(resolveImageProvider({ env: { GEMINI_API_KEY: 'g' } }).name).toBe('gemini');
    expect(() => resolveImageProvider({ env: {} })).toThrow(expect.objectContaining({ code: 'E_USAGE' }));
  });

  it('maps the aspect to the model, waits out throttling and polls until the image is ready', async () => {
    const calls = [];
    const responses = [
      json({ retry_after: 1 }, 429),
      json({ status: 'processing', urls: { get: 'https://replicate.test/p/1' } }),
      json({ status: 'succeeded', output: ['https://replicate.test/out.png'] }),
      png(),
    ];
    const fetchImpl = async (url, options) => {
      calls.push({ url, body: options?.body ? JSON.parse(options.body) : null });
      return responses.shift();
    };
    const provider = resolveImageProvider({ env: { REPLICATE_API_TOKEN: 'r8' }, fetchImpl, sleep: async () => {} });

    const { buffer, model } = await provider.generate({
      slot: 'team',
      prompt: 'p',
      aspect: '4:5',
      model: 'google/nano-banana-pro',
    });

    expect(model).toBe('google/nano-banana-pro');
    expect(buffer.subarray(0, 4)).toEqual(Buffer.from([137, 80, 78, 71]));
    expect(calls[0].url).toBe('https://api.replicate.com/v1/models/google/nano-banana-pro/predictions');
    expect(calls[1].body.input).toMatchObject({ aspect_ratio: '4:5', output_format: 'png' });
    expect(calls.map((call) => call.url)).toContain('https://replicate.test/p/1');
  });

  it('refuses a Replicate model it has no adapter for', async () => {
    const provider = resolveImageProvider({ env: { REPLICATE_API_TOKEN: 'r8' }, fetchImpl: async () => png() });

    await expect(provider.generate({ slot: 'x', prompt: 'p', aspect: '1:1', model: 'acme/unknown' })).rejects.toThrow(
      /no adapter/,
    );
  });
});

describe('generateImages and optimizeImages', () => {
  it('writes the masters, keeps going when one slot fails, and converts them to WebP', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-images-'));
    const provider = {
      generate: async ({ slot }) => {
        if (slot === 'team') {
          throw new Error('quota exceeded');
        }

        return { buffer: Buffer.from('png-bytes'), model: 'openai/gpt-image-2' };
      },
    };

    const results = await generateImages({ root, manifest: MANIFEST, slots: MANIFEST.slots, provider });

    expect(results.map((result) => [result.slot, result.ok])).toEqual([
      ['hero', true],
      ['team', false],
    ]);
    expect(fs.readFileSync(path.join(root, 'assets/img-source/hero.png'), 'utf8')).toBe('png-bytes');

    const converted = [];
    const sharp = (source) => ({
      webp: () => ({
        toFile: async (target) => {
          converted.push(path.relative(root, source));
          fs.writeFileSync(target, 'webp-bytes');
        },
      }),
    });
    const optimized = await optimizeImages({ root, manifest: MANIFEST, sharp });
    const again = await optimizeImages({ root, manifest: MANIFEST, sharp });

    expect(converted).toEqual(['assets/img-source/hero.png']);
    expect(optimized[0]).toMatchObject({ file: 'public/assets/img/photos/hero.webp', skipped: false });
    expect(again[0]).toMatchObject({ skipped: true });
  });
});

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { answerQuestion, chunksOf } from '../src/ai/help.js';
import { LOCAL_MODEL, modelDir } from '../src/ai/model/files.js';
import { installModel, modelStatus, removeModel } from '../src/ai/model/install.js';
import { createTokenizer } from '../src/ai/model/tokenizer.js';
import { loadEmbedder } from '../src/ai/model/embedder.js';
import { proposeCommandWithModel } from '../src/ai/propose.js';
import { makeTempDir } from './helpers.js';

const VOCAB = ['[PAD]', '[UNK]', '[CLS]', '[SEP]', 'add', 'a', 'page', '##s', 'cafe', '(', ')', 'k', 'faq'];
const tokenizer = createTokenizer({ model: { vocab: Object.fromEntries(VOCAB.map((token, id) => [token, id])) } });

describe('tokenizer', () => {
  it('lower-cases, drops accents, splits punctuation and cuts words into known pieces', () => {
    expect(tokenizer.encode('Add a Pages (FAQ)')).toEqual([2, 4, 5, 6, 7, 9, 12, 10, 3]);
    expect(tokenizer.encode('Café')).toEqual([2, 8, 3]);
    expect(tokenizer.encode('⌘K zzz')).toEqual([2, 1, 1, 3]);
    expect(tokenizer.encode('add '.repeat(300))).toHaveLength(128);
  });
});

/** A fetch that serves `files` (name → content) for the pinned URLs. */
const fakeFetch = (files) => async (url) => {
  const entry = LOCAL_MODEL.files.find((candidate) => candidate.url === url);
  const content = files[entry.name];
  return content === undefined
    ? { ok: false, status: 404 }
    : { ok: true, status: 200, arrayBuffer: async () => content };
};

describe('model install', () => {
  it('reports what is missing, refuses a file that does not match its hash, and leaves no partial file', async () => {
    const env = { LINK_LOOM_CACHE: makeTempDir() };
    const status = modelStatus(env);

    expect(status).toMatchObject({ installed: false, missing: LOCAL_MODEL.files.map((entry) => entry.name) });
    expect(status.bytesToDownload).toBeGreaterThan(30 * 1048576);
    await expect(
      installModel({ env, fetchImpl: fakeFetch({ 'model_quantized.onnx': Buffer.from('not the model') }) }),
    ).rejects.toMatchObject({ code: 'E_FETCH' });
    expect(fs.readdirSync(modelDir(env))).toEqual([]);
    expect(removeModel(env).installed).toBe(false);
  });

  it('pins every file to an https address and a SHA-256', () => {
    for (const entry of LOCAL_MODEL.files) {
      expect(entry.url).toMatch(/^https:\/\/(huggingface\.co|cdn\.jsdelivr\.net)\//);
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(createHash('sha256').update('').digest('hex')).not.toBe(LOCAL_MODEL.files[0].sha256);
  });
});

describe('help', () => {
  it('cuts documents at headings, one passage per table row', () => {
    const file = path.join(makeTempDir(), 'AGENTS.md');
    fs.writeFileSync(
      file,
      '# Guide\n\nUse the CLI.\n\n## Kinds\n\n| Kind | For |\n| --- | --- |\n| `faq` | Questions |\n| `logos` | Logo tiles |\n',
    );

    expect(chunksOf(file).map(({ heading, text }) => [heading, text])).toEqual([
      ['Guide', 'Use the CLI.'],
      ['Kinds', '`faq` — Questions'],
      ['Kinds', '`logos` — Logo tiles'],
    ]);
  });

  it('answers from the project documents by shared words, also for a Spanish question', async () => {
    const projectRoot = makeTempDir();
    fs.writeFileSync(
      path.join(projectRoot, 'AGENTS.md'),
      '# Site\n\n## Pages\n\nA page is added with `npx link-loom add page --path /pricing`.\n\n## Colours\n\nColours are tokens of _tokens.scss.\n',
    );

    const [english] = await answerQuestion('how do I add a page?', { projectRoot });
    const [spanish] = await answerQuestion('¿cómo cambio los colores?', { projectRoot });

    expect(english).toMatchObject({ source: 'AGENTS.md', heading: 'Pages' });
    expect(spanish).toMatchObject({ heading: 'Colours' });
    expect(await answerQuestion('zzz qqq', { projectRoot })).toEqual([]);
  });
});

// The model itself: only where it is installed (`link-loom ai install`), never downloaded by the tests.
const installed = modelStatus().installed;
(installed ? describe : describe.skip)('with the installed model', () => {
  let embedder;
  beforeAll(async () => {
    embedder = await loadEmbedder();
  });

  it('routes a request the rules miss, and turns down small talk', async () => {
    expect(
      (await proposeCommandWithModel('publica algo sobre el lanzamiento en el blog', { type: 'landing' }, embedder))
        ?.intent,
    ).toBe('add_blog_post');
    expect(await proposeCommandWithModel('¿Qué clima hace hoy en Bogotá?', {}, embedder)).toBeNull();
  });
});

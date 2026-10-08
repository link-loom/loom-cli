import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { similarity } from './model/embedder.js';
import { normalizeText } from './text.js';

const CLI_README = fileURLToPath(new URL('../../README.md', import.meta.url));
const MAX_CHUNK = 700;
const STOPWORDS = new Set(
  'a an and are as at be by can de del do does el en es for how i in is it la las los me mi my of on or para por que se the to un una what with y como hago puedo'.split(
    ' ',
  ),
);

/** The documents help answers from: the project's AGENTS.md and agent skills, and the CLI's own README. */
export const helpSources = (projectRoot) => {
  const files = [CLI_README];
  if (projectRoot) {
    files.unshift(path.join(projectRoot, 'AGENTS.md'));
    const skills = path.join(projectRoot, '.claude', 'skills');
    if (fs.existsSync(skills)) {
      fs.readdirSync(skills).forEach((skill) => files.push(path.join(skills, skill, 'SKILL.md')));
    }
  }

  return files.filter((file) => fs.existsSync(file));
};

const isTable = (paragraph) => paragraph.split('\n').every((line) => line.trim().startsWith('|'));

/** A table row as a sentence: "`faq` — Questions and answers…" (the separator row and the header are dropped). */
const tableRows = (paragraph) =>
  paragraph
    .split('\n')
    .slice(2)
    .map((row) =>
      row
        .split(/(?<!\\)\|/)
        .map((cell) => cell.trim().replace(/\\\|/g, '|'))
        .filter(Boolean)
        .join(' — '),
    )
    .filter(Boolean);

/**
 * A markdown file cut at its headings; long sections are cut again at blank lines, and each row of a table is a
 * passage of its own (a table answers one row at a time).
 */
export const chunksOf = (file) => {
  const chunks = [];
  let heading = path.basename(file);
  let buffer = [];
  const flush = () => {
    const text = buffer.join('\n').trim();
    buffer = [];
    if (!text) return;
    let current = '';
    for (const paragraph of text.split(/\n\s*\n/)) {
      if (isTable(paragraph)) {
        tableRows(paragraph).forEach((row) => chunks.push({ source: file, heading, text: row }));
        continue;
      }

      if (current && current.length + paragraph.length > MAX_CHUNK) {
        chunks.push({ source: file, heading, text: current.trim() });
        current = '';
      }

      current += `${paragraph}\n\n`;
    }

    if (current.trim()) chunks.push({ source: file, heading, text: current.trim() });
  };

  for (const line of fs
    .readFileSync(file, 'utf8')
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .split('\n')) {
    const title = /^#{1,4}\s+(.+)$/.exec(line);
    if (title) {
      flush();
      heading = title[1].trim();
      continue;
    }

    buffer.push(line);
  }

  flush();
  return chunks;
};

// The documents are in English: a Spanish question also asks with these words.
const SPANISH_TERMS = Object.freeze({
  pagina: ['page'],
  paginas: ['pages'],
  seccion: ['section'],
  secciones: ['sections'],
  agrego: ['add'],
  agregar: ['add'],
  agrega: ['add'],
  anado: ['add'],
  anadir: ['add'],
  crear: ['create'],
  creo: ['create'],
  colores: ['colours', 'colors', 'tokens'],
  color: ['colour', 'color', 'tokens'],
  publicacion: ['post', 'blog'],
  entrada: ['post', 'blog'],
  articulo: ['post', 'blog'],
  menu: ['menu', 'nav'],
  pie: ['footer'],
  encabezado: ['header'],
  idioma: ['language', 'locale'],
  imagen: ['image', 'images'],
  imagenes: ['images'],
  textos: ['copy', 'text'],
  texto: ['copy', 'text'],
  traduccion: ['spanish', 'copy'],
  pruebas: ['tests'],
  prueba: ['test'],
  desplegar: ['deploy'],
  despliegue: ['deploy'],
  verificar: ['verify', 'check'],
  entidad: ['entity'],
  lista: ['list'],
  marca: ['brand'],
  iconos: ['icons'],
});

const termsOf = (text) =>
  normalizeText(text)
    .split(/[^a-z0-9-]+/)
    .filter((term) => term.length > 1 && !STOPWORDS.has(term));

/** Lexical ranking (term overlap weighted by rarity, the heading counting double): help without the model. */
const lexicalScores = (question, chunks) => {
  const asked = new Set(termsOf(question).flatMap((term) => [term, ...(SPANISH_TERMS[term] || [])]));
  const documents = chunks.map((chunk) => new Set(termsOf(`${chunk.heading} ${chunk.heading} ${chunk.text}`)));
  const rarity = (term) => Math.log(1 + chunks.length / (1 + documents.filter((terms) => terms.has(term)).length));
  return documents.map((terms) => [...asked].reduce((sum, term) => sum + (terms.has(term) ? rarity(term) : 0), 0));
};

// With the model, a passage must be at least this close in meaning; shared words then add to its score.
const MIN_MEANING = 0.25;
const WORDS_WEIGHT = 0.2;

/**
 * The passages of the documents that answer a question, best first: extractive, word for word, never written. Without
 * the sentence encoder they rank by the words they share with the question; with it, by meaning plus shared words,
 * and a passage far in meaning is no answer.
 */
export const answerQuestion = async (question, { projectRoot, embedder = null, limit = 3 } = {}) => {
  const chunks = helpSources(projectRoot).flatMap(chunksOf);
  const words = lexicalScores(question, chunks);
  const meanings = embedder ? await meaningScores(embedder, question, chunks) : null;
  return chunks
    .map((chunk, index) => ({
      ...chunk,
      source: path.relative(projectRoot || process.cwd(), chunk.source) || chunk.source,
      score: meanings ? meanings[index] + WORDS_WEIGHT * words[index] : words[index],
      relevant: meanings ? meanings[index] >= MIN_MEANING : words[index] > 0,
    }))
    .filter((chunk) => chunk.relevant)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ relevant: _relevant, ...chunk }) => chunk);
};

const meaningScores = async (embedder, question, chunks) => {
  const asked = await embedder.embed(question);
  return Promise.all(
    chunks.map(async (chunk) => similarity(asked, await embedder.embed(`${chunk.heading}. ${chunk.text}`))),
  );
};

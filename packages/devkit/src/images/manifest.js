import { ERROR_CODES, LoomError } from '../errors.js';

export const IMAGE_MANIFEST_FILE = 'images.manifest.json';

// Generation costs money and every batch needs a human look: at most five slots per run, named one by one.
export const MAX_SLOTS_PER_RUN = 5;

const invalid = (message) =>
  new LoomError(ERROR_CODES.validation, `${IMAGE_MANIFEST_FILE}: ${message}`, { missing: [], problems: [] });

/**
 * The project's image manifest: where masters and deliverables live, reusable style blocks and one entry per slot.
 *
 *   { sourceDir, outputDir, model?, styles: { name: text }, slots: [{ slot, filename, aspect, prompt, styles?, model?,
 *     removeBackground? }] }
 */
export const parseImageManifest = (text) => {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    throw invalid(`not valid JSON (${error.message})`);
  }

  if (!manifest.sourceDir || !manifest.outputDir || !Array.isArray(manifest.slots)) {
    throw invalid('needs sourceDir, outputDir and a slots array');
  }

  const broken = manifest.slots.filter((entry) => !entry.slot || !entry.filename || !entry.prompt || !entry.aspect);
  if (broken.length) {
    throw invalid(
      `every slot needs slot, filename, aspect and prompt (check ${broken.map((entry) => entry.slot || '?').join(', ')})`,
    );
  }

  return manifest;
};

/** The prompt a model receives: the slot's own text followed by the style blocks it names. */
export const composePrompt = (manifest, entry) =>
  [entry.prompt, ...(entry.styles || []).map((name) => manifest.styles?.[name]).filter(Boolean)].join('\n\n');

/** The slots of a run, by name; unknown names and runs over the budget are refused. */
export const selectSlots = (manifest, names) => {
  if (!names.length) {
    throw new LoomError(ERROR_CODES.usage, `Name the slots to generate (at most ${MAX_SLOTS_PER_RUN})`, {
      allowed: manifest.slots.map((entry) => entry.slot),
    });
  }

  if (names.length > MAX_SLOTS_PER_RUN) {
    throw new LoomError(
      ERROR_CODES.usage,
      `At most ${MAX_SLOTS_PER_RUN} slots per run; review this batch before the next`,
    );
  }

  const bySlot = new Map(manifest.slots.map((entry) => [entry.slot, entry]));
  const unknown = names.filter((name) => !bySlot.has(name));
  if (unknown.length) {
    throw new LoomError(ERROR_CODES.usage, `Unknown slot(s): ${unknown.join(', ')}`, { allowed: [...bySlot.keys()] });
  }

  return names.map((name) => bySlot.get(name));
};

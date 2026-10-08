import fs from 'node:fs';
import path from 'node:path';

const WEBP_QUALITY = 85;
const WEBP_EFFORT = 5;

const walkPngs = (directory, relative = '') => {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || entry.name === '_tmp') {
      return [];
    }

    const relativePath = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      return walkPngs(path.join(directory, entry.name), relativePath);
    }

    return entry.name.toLowerCase().endsWith('.png') ? [relativePath] : [];
  });
};

const isStale = (source, target) => !fs.existsSync(target) || fs.statSync(target).mtimeMs < fs.statSync(source).mtimeMs;

/**
 * Converts the PNG masters of `sourceDir` into WebP deliverables in `outputDir` (same relative paths). Only what is
 * missing or older than its master, unless `force`; `only` limits it to some masters (path without extension or
 * basename). `sharp` comes from the project, so the CLI itself carries no native image library.
 */
export const optimizeImages = async ({ root, manifest, sharp, force = false, only = [], dryRun = false }) => {
  const sourceDir = path.join(root, manifest.sourceDir);
  const wanted = new Set(only.map((name) => name.replace(/\.png$/i, '')));
  const masters = walkPngs(sourceDir).filter((file) => {
    const withoutExtension = file.replace(/\.png$/i, '');
    return !wanted.size || wanted.has(withoutExtension) || wanted.has(path.basename(withoutExtension));
  });

  const results = [];
  for (const master of masters) {
    const source = path.join(sourceDir, master);
    const relativeOutput = path.join(manifest.outputDir, master.replace(/\.png$/i, '.webp'));
    const target = path.join(root, relativeOutput);
    if (!force && !isStale(source, target)) {
      results.push({ file: relativeOutput, skipped: true });
      continue;
    }

    if (dryRun) {
      results.push({ file: relativeOutput, skipped: false, planned: true });
      continue;
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    await sharp(source).webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT }).toFile(target);
    results.push({
      file: relativeOutput,
      skipped: false,
      inBytes: fs.statSync(source).size,
      outBytes: fs.statSync(target).size,
    });
  }

  return results;
};

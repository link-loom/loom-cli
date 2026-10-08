import { ERROR_CODES, LoomError, appendToArray } from '@link-loom/devkit';

import { camelCase } from '../entity/naming.js';
import { FILES, addCopy, addIcon, readRequired, requireWebapp, within } from '../shared/project.js';

/** `add platform-section`: a card on a platform's page of Advanced settings, and its copy. */
export default async function platformSectionGenerator(tree, options, context = {}) {
  requireWebapp(context.project, 'platform-section');
  if (!(context.project.layers || []).includes('stoneos')) {
    throw new LoomError(
      ERROR_CODES.notAvailable,
      'Platform pages come with the stoneos layer, which this app does not have',
    );
  }

  const files = within(tree, context.directory);
  const key = camelCase(options.id);
  const copyPath = `platforms.sections.${options.platform}.${key}`;
  const copyOf = (title, description) => ({
    platforms: { sections: { [options.platform]: { [key]: { title, description } } } },
  });
  addCopy(
    files,
    {
      en: copyOf(options.titleEn, options.descriptionEn),
      es: copyOf(options.titleEs || options.titleEn, options.descriptionEs || options.descriptionEn),
    },
    { owned: [copyPath] },
  );
  addIcon(files, options.icon);
  const element = `{ id: "${options.id}", to: "${options.to}", titleKey: "${copyPath}.title", descriptionKey: "${copyPath}.description", icon: "${options.icon}" }`;
  files.overwrite(
    FILES.platformSections,
    appendToArray(readRequired(files, FILES.platformSections), {
      name: 'PLATFORM_SECTIONS',
      path: [options.platform],
      element,
      id: options.id,
      file: FILES.platformSections,
    }),
  );
  const pending = [!options.titleEs && 'titleEs', !options.descriptionEs && 'descriptionEs'].filter(Boolean);
  return {
    warnings: pending.length ? [`Spanish copy fell back to English for: ${pending.join(', ')}`] : [],
    project: { platformSection: { platform: options.platform, id: options.id } },
    next: ['npm run verify'],
  };
}

import { appendToArray } from '@link-loom/devkit';

import { camelCase } from '../entity/naming.js';
import { FILES, addCopy, addIcon, readRequired, requireWebapp, within } from '../shared/project.js';

/** `add settings-section`: a card of Advanced settings and its copy. */
export default async function settingsSectionGenerator(tree, options, context = {}) {
  requireWebapp(context.project, 'settings-section');
  const files = within(tree, context.directory);
  const key = camelCase(options.id);
  const titleKey = `management.titles.${key}`;
  const descriptionKey = `management.sections.${key}`;
  addCopy(
    files,
    {
      en: { management: { titles: { [key]: options.titleEn }, sections: { [key]: options.descriptionEn } } },
      es: {
        management: {
          titles: { [key]: options.titleEs || options.titleEn },
          sections: { [key]: options.descriptionEs || options.descriptionEn },
        },
      },
    },
    { owned: [titleKey, descriptionKey] },
  );
  addIcon(files, options.icon);
  const element = [
    '{',
    `    id: "${options.id}",`,
    `    to: "${options.to}",`,
    `    titleKey: "${titleKey}",`,
    `    descriptionKey: "${descriptionKey}",`,
    `    icon: "${options.icon}",`,
    `    color: "${options.color}",`,
    '  }',
  ].join('\n');
  files.overwrite(
    FILES.managementSections,
    appendToArray(readRequired(files, FILES.managementSections), {
      name: 'MANAGEMENT_SECTIONS',
      element,
      id: options.id,
      file: FILES.managementSections,
    }),
  );
  const pending = [!options.titleEs && 'titleEs', !options.descriptionEs && 'descriptionEs'].filter(Boolean);
  return {
    warnings: pending.length ? [`Spanish copy fell back to English for: ${pending.join(', ')}`] : [],
    project: { settingsSection: { id: options.id, to: options.to } },
    next: ['npm run verify'],
  };
}

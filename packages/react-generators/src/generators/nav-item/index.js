import { camelCase } from '../entity/naming.js';
import {
  addCopy,
  addIcon,
  addNavigationEntry,
  addNavigationGroup,
  addNavigationGroupItem,
  copyTreeAt,
  hasNavigationEntry,
  requireWebapp,
  within,
} from '../shared/project.js';

const addLabel = (files, key, en, es) => addCopy(files, copyTreeAt(key, { en, es: es || en }), { owned: [key] });

/** `add nav-item`: a sidebar row and its label, optionally under a section title or inside a group. */
export default async function navItemGenerator(tree, options, context = {}) {
  requireWebapp(context.project, 'nav-item');
  const files = within(tree, context.directory);
  const labelKey = `nav.${camelCase(options.id)}`;
  addLabel(files, labelKey, options.labelEn, options.labelEs);
  addIcon(files, options.icon);

  const sectionKey = options.sectionEn ? `nav.sections.${camelCase(options.group || options.id)}` : undefined;
  if (sectionKey) addLabel(files, sectionKey, options.sectionEn, options.sectionEs);

  if (!options.group) {
    addNavigationEntry(files, {
      id: options.id,
      labelKey,
      icon: options.icon,
      to: options.to,
      before: options.last ? null : options.before,
      sectionKey,
    });
  }

  if (options.group && !hasNavigationEntry(files, options.group)) {
    const groupKey = `nav.${camelCase(options.group)}`;
    addLabel(files, groupKey, options.groupEn || options.labelEn, options.groupEs || options.groupEn);
    addIcon(files, options.groupIcon);
    addNavigationGroup(files, {
      id: options.group,
      labelKey: groupKey,
      icon: options.groupIcon,
      before: options.before,
      sectionKey,
    });
  }

  if (options.group) {
    addNavigationGroupItem(files, {
      group: options.group,
      id: options.id,
      labelKey,
      icon: options.icon,
      to: options.to,
    });
  }

  const missing = [
    ...(options.labelEs ? [] : ['labelEs']),
    ...(options.sectionEn && !options.sectionEs ? ['sectionEs'] : []),
    ...(options.groupEn && !options.groupEs ? ['groupEs'] : []),
  ];
  return {
    warnings: missing.length ? [`Spanish copy fell back to English for: ${missing.join(', ')}`] : [],
    project: { navigation: { id: options.id, to: options.to, ...(options.group ? { group: options.group } : {}) } },
    next: ['npm run verify'],
  };
}

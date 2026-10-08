import { inlineOf } from './naming.js';

const ES_GENDER = Object.freeze({
  m: { new: 'Nuevo', article: 'Los', none: 'Ningún', this: 'este', pronoun: 'lo', one: 'un nuevo' },
  f: { new: 'Nueva', article: 'Las', none: 'Ninguna', this: 'esta', pronoun: 'la', one: 'una nueva' },
});

const capitalize = (text) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const fieldCopy = (fields, locale) => ({
  fields: Object.fromEntries(fields.map((field) => [field.name, locale === 'en' ? field.labelEn : field.labelEs])),
  ...(fields.some((field) => field.options.length)
    ? {
        options: Object.fromEntries(
          fields.filter((field) => field.options.length).map((field) => [field.name, field.optionLabels[locale]]),
        ),
      }
    : {}),
});

const actionCopy = (actions, locale) =>
  actions.length
    ? {
        actions: Object.fromEntries(
          actions.map((action) => [action.key, locale === 'en' ? action.labelEn : action.labelEs]),
        ),
      }
    : {};

const deleteLabelOf = (catalogLabels, locale) => {
  const renamed = catalogLabels.find((action) => action.id === 'delete');
  return renamed && (locale === 'en' ? renamed.labelEn : renamed.labelEs);
};

const CONFIRM_DESCRIPTIONS = Object.freeze({
  replace: {
    en: (singular) => `A new ${singular} with the same data replaces it, and this one stops working right away.`,
    es: (singular, gender) =>
      `${capitalize(gender.one)} ${singular} con los mismos datos ${gender.pronoun} reemplaza, y ${gender.this} deja de funcionar de inmediato.`,
  },
  call: {
    en: () => 'It runs on the server right away.',
    es: () => 'Se ejecuta en el servidor de inmediato.',
  },
});

const confirmable = (actions) => actions.filter((action) => CONFIRM_DESCRIPTIONS[action.kind]);

const confirmCopyEn = (actions, singular) =>
  Object.fromEntries(
    confirmable(actions).map((action) => [
      `${action.key}Confirm`,
      { title: `${action.labelEn} this ${singular}?`, description: CONFIRM_DESCRIPTIONS[action.kind].en(singular) },
    ]),
  );

const confirmCopyEs = (actions, singular, gender) =>
  Object.fromEntries(
    confirmable(actions).map((action) => [
      `${action.key}Confirm`,
      {
        title: `¿${capitalize(inlineOf(action.labelEs))} ${gender.this} ${singular}?`,
        description: CONFIRM_DESCRIPTIONS[action.kind].es(singular, gender),
      },
    ]),
  );

/** The English copy of one entity. */
export const entityCopyEn = ({ labels, fields, actions, catalogLabels = [] }) => {
  const singular = inlineOf(labels.singularEn);
  const plural = inlineOf(labels.pluralEn);
  const deleteLabel = deleteLabelOf(catalogLabels, 'en') || 'Delete';
  return {
    singular: labels.singularEn,
    plural: labels.pluralEn,
    description: labels.descriptionEn || `The ${plural} of your organization.`,
    new: `New ${singular}`,
    create: `Create ${singular}`,
    searchPlaceholder: `Search ${plural}`,
    emptyTitle: `No ${plural} yet`,
    emptyDescription: `The ${plural} you create appear here.`,
    filteredEmptyTitle: `No ${plural} match these filters`,
    notFound: `This ${singular} does not exist, or you cannot see it.`,
    backToList: `Back to ${plural}`,
    quickAddHint: `Opens the form for a new ${singular}`,
    tabDetails: 'Details',
    requiredMissing: 'Fill in: {fields}',
    actionFailed: 'That did not work. Try again.',
    deleteConfirm: {
      title: `${deleteLabel} this ${singular}?`,
      action: deleteLabel,
      description: `It leaves the list and can no longer be used.`,
    },
    ...confirmCopyEn(actions, singular),
    ...fieldCopy(fields, 'en'),
    ...actionCopy([...catalogLabels, ...actions], 'en'),
  };
};

/** The Spanish copy of one entity; `gender` (m|f) agrees the articles with the noun. */
export const entityCopyEs = ({ labels, fields, actions, catalogLabels = [] }) => {
  const gender = ES_GENDER[labels.genderEs] || ES_GENDER.m;
  const singular = inlineOf(labels.singularEs);
  const plural = inlineOf(labels.pluralEs);
  const deleteLabel = deleteLabelOf(catalogLabels, 'es') || 'Eliminar';
  return {
    singular: labels.singularEs,
    plural: labels.pluralEs,
    description: labels.descriptionEs || `${gender.article} ${plural} de tu organización.`,
    new: `${gender.new} ${singular}`,
    create: `Crear ${singular}`,
    searchPlaceholder: `Buscar ${plural}`,
    emptyTitle: `Aún no hay ${plural}`,
    emptyDescription: `${gender.article} ${plural} que crees aparecen aquí.`,
    filteredEmptyTitle: `${gender.none} ${singular} coincide con estos filtros`,
    notFound: `${capitalize(gender.this)} ${singular} no existe, o no tienes acceso.`,
    backToList: `Volver a ${plural}`,
    quickAddHint: `Abre el formulario de ${gender.one} ${singular}`,
    tabDetails: 'Detalles',
    requiredMissing: 'Completa: {fields}',
    actionFailed: 'No se pudo completar. Inténtalo de nuevo.',
    deleteConfirm: {
      title: `¿${deleteLabel} ${gender.this} ${singular}?`,
      action: deleteLabel,
      description: 'Sale de la lista y ya no se puede usar.',
    },
    ...confirmCopyEs(actions, singular, gender),
    ...fieldCopy(fields, 'es'),
    ...actionCopy([...catalogLabels, ...actions], 'es'),
  };
};

/** Words every record shares; a later entity finds them already there. */
export const COMMON_COPY = Object.freeze({
  en: {
    cancel: 'Cancel',
    close: 'Close',
    untitled: 'Untitled',
    options: 'Options',
    copied: 'Copied',
    copyLink: 'Copy link',
    linkCopied: 'Link copied',
    yes: 'Yes',
    no: 'No',
  },
  es: {
    cancel: 'Cancelar',
    close: 'Cerrar',
    untitled: 'Sin título',
    options: 'Opciones',
    copied: 'Copiado',
    copyLink: 'Copiar enlace',
    linkCopied: 'Enlace copiado',
    yes: 'Sí',
    no: 'No',
  },
});

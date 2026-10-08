import { GENERATOR_STATUS } from '@link-loom/devkit';

import { getCollection } from './collections.js';

/** `link-loom create <target>`: which collection and generator each target runs. */
export const CREATE_TARGETS = Object.freeze({
  landing: { collection: '@link-loom/astro-generators', generator: 'landing' },
  webapp: { collection: '@link-loom/react-generators', generator: 'webapp' },
  service: { collection: '@link-loom/node-generators', generator: 'service' },
});

/** The answers to "What do you want to create?", in the order the TUI shows them. */
export const PROJECT_TYPES = Object.freeze([
  {
    id: 'landing',
    target: 'landing',
    defaults: {},
    label: { en: 'Landing page', es: 'Landing page' },
    summary: {
      en: 'Astro, en/es, SEO and GEO, blog, search, editor',
      es: 'Astro, en/es, SEO y GEO, blog, buscador, editor',
    },
  },
  {
    id: 'webapp-client',
    target: 'webapp',
    defaults: { variant: 'client' },
    label: { en: 'Webapp · client', es: 'Webapp · client' },
    summary: { en: 'React app for the people who run the operation', es: 'App React para quienes operan' },
  },
  {
    id: 'webapp-admin',
    target: 'webapp',
    defaults: { variant: 'admin' },
    label: { en: 'Webapp · admin', es: 'Webapp · admin' },
    summary: {
      en: 'React app for the people who run the platform',
      es: 'App React para quienes administran la plataforma',
    },
  },
  {
    id: 'service-monolith',
    target: 'service',
    defaults: { shape: 'monolith' },
    label: { en: 'Backend monolith', es: 'Backend monolito' },
    summary: { en: 'A service on the Link Loom SDK', es: 'Un servicio sobre el SDK de Link Loom' },
  },
  {
    id: 'service-microservice',
    target: 'service',
    defaults: { shape: 'microservice' },
    label: { en: 'Microservice', es: 'Microservicio' },
    summary: { en: 'A focused service on the Link Loom SDK', es: 'Un servicio acotado sobre el SDK de Link Loom' },
  },
  {
    id: 'stoneos-app',
    target: null,
    defaults: {},
    label: { en: 'StoneOS app', es: 'App de StoneOS' },
    summary: { en: 'An App Engine app', es: 'Una app de App Engine' },
  },
]);

export const generatorFor = (target) => {
  const spec = CREATE_TARGETS[target];
  if (!spec) {
    return null;
  }

  return getCollection(spec.collection).generators[spec.generator] || null;
};

export const projectTypeStatus = (projectType) =>
  projectType.target ? generatorFor(projectType.target)?.status || GENERATOR_STATUS.planned : GENERATOR_STATUS.planned;

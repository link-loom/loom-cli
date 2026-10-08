import {
  ERROR_CODES,
  LoomError,
  SERVICES,
  VirtualTree,
  applyTree,
  readDotenv,
  serviceIds,
  setDotenv,
} from '@link-loom/devkit';

import { createResult } from '../cli/output.js';
import { findProject } from './project.js';

export const SERVICE_ACTIONS = Object.freeze(['list', 'add', 'config']);

const LOCAL_ENV = '.env.local';
const SAMPLE_ENV = '.env.sample';

const serviceOf = (id) => {
  if (!SERVICES[id]) {
    throw new LoomError(ERROR_CODES.usage, `Unknown service: ${id || '(none)'}`, { allowed: serviceIds() });
  }

  return SERVICES[id];
};

/** A service's keys as they may be shown: whether each one is set, never its value. */
const keyStatus = (service, local) =>
  service.env.map(({ key, secret = false }) => ({ key, secret, set: Boolean(local[key]) }));

const isActive = (service, manifest, local) =>
  (!service.layer || (manifest.layers || []).includes(service.layer)) && service.env.some(({ key }) => key in local);

/**
 * The values to write: `--from-env` reads every key of the service from the environment (secrets travel only this
 * way), and `--url` sets its URL key.
 */
const valuesFor = (service, { input, global, env }) => {
  const values = {};
  for (const { key, url } of service.env) {
    if (global.fromEnv && env[key] !== undefined) {
      values[key] = env[key];
    }

    if (url && input.url !== undefined) {
      values[key] = String(input.url);
    }
  }

  return values;
};

/**
 * `link-loom services <list|add|config> [service]` in a project: lists the services and which keys are set, or
 * writes a service's keys to .env.local (values) and .env.sample (empty placeholders). Values never reach the output.
 */
export const runServices = async ({ action, serviceId, input = {}, global = {}, cwd, env = process.env }) => {
  if (!SERVICE_ACTIONS.includes(action)) {
    throw new LoomError(ERROR_CODES.usage, 'Missing or unknown services action', { allowed: SERVICE_ACTIONS });
  }

  const project = findProject(cwd);
  const tree = new VirtualTree({ root: project.root });
  const local = readDotenv(tree.read(LOCAL_ENV) || '');

  if (action === 'list') {
    const services = Object.entries(SERVICES).map(([id, service]) => ({
      id,
      label: service.label,
      active: isActive(service, project.manifest, local),
      keys: keyStatus(service, local),
    }));
    return createResult({ command: 'services list', project: { root: project.root }, data: { services } });
  }

  const service = serviceOf(serviceId);
  if (action === 'config' && !isActive(service, project.manifest, local)) {
    throw new LoomError(
      ERROR_CODES.usage,
      `${serviceId} is not set up in this project; use \`services add ${serviceId}\``,
    );
  }

  const values = valuesFor(service, { input, global, env });
  const placeholders = Object.fromEntries(service.env.map(({ key }) => [key, '']));
  const sample = readDotenv(tree.read(SAMPLE_ENV) || '');
  const missingInSample = Object.fromEntries(Object.entries(placeholders).filter(([key]) => !(key in sample)));
  const missingLocally = Object.fromEntries(Object.entries(placeholders).filter(([key]) => !(key in local)));

  const currentLocal = tree.read(LOCAL_ENV) || '';
  const nextLocal = setDotenv(currentLocal, { ...missingLocally, ...values });
  if (nextLocal !== currentLocal) {
    tree.overwrite(LOCAL_ENV, nextLocal);
  }

  if (Object.keys(missingInSample).length) {
    tree.overwrite(SAMPLE_ENV, setDotenv(tree.read(SAMPLE_ENV) || '', missingInSample));
  }

  const written = readDotenv(tree.read(LOCAL_ENV));
  const result = {
    command: `services ${action} ${serviceId}`,
    project: { root: project.root },
    plan: tree.plan(),
    data: { service: serviceId, keys: keyStatus(service, written) },
    next: keyStatus(service, written)
      .filter((key) => !key.set)
      .map((key) => `${key.key}=<value> link-loom services config ${serviceId} --from-env`),
  };

  if (global.dryRun) {
    return createResult({ ...result, dryRun: true });
  }

  if (result.plan.modify.length && !global.yes) {
    throw new LoomError(
      ERROR_CODES.confirmationRequired,
      `services ${action} changes existing env files; review the plan and pass --yes`,
      {
        plan: result.plan,
      },
    );
  }

  applyTree(tree);
  return createResult(result);
};

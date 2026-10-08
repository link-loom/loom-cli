import path from 'node:path';

export const toPosix = (value) => value.split(path.sep).join('/');

export const normalizeTreePath = (value) => {
  const normalized = path.posix.normalize(toPosix(String(value || '')).replace(/^\/+/, ''));
  if (!normalized || normalized === '.' || normalized.startsWith('..')) {
    throw new Error(`Invalid tree path: ${value}`);
  }

  return normalized;
};

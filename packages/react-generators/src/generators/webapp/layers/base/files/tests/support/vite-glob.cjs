const fs = require("node:fs");
const path = require("node:path");

const toRegExp = (pattern) =>
  new RegExp(
    `^${pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*\//g, "\u0000")
      .replace(/\*/g, "[^/]*")
      .replace(/\u0000/g, "(?:.*/)?")}$`
  );

const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });

const relativeKey = (fromDir, file) => {
  const relative = path.relative(fromDir, file).split(path.sep).join("/");
  return relative.startsWith(".") ? relative : `./${relative}`;
};

/** `import.meta.glob(pattern, { eager })` for Jest: the same keys Vite uses, relative to the importing file. */
exports.viteGlob = (fromDir, pattern, options = {}) => {
  const staticPart = pattern.slice(0, pattern.search(/[*{]/));
  const root = path.resolve(fromDir, staticPart.endsWith("/") ? staticPart : path.dirname(staticPart));
  const matcher = toRegExp(pattern);
  const files = fs.existsSync(root) ? walk(root).filter((file) => matcher.test(relativeKey(fromDir, file))) : [];

  return Object.fromEntries(
    files.map((file) => [relativeKey(fromDir, file), options.eager ? require(file) : () => Promise.resolve(require(file))])
  );
};

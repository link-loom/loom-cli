const path = require("node:path");

const GLOB_RUNTIME = path.join(__dirname, "vite-glob.cjs");

const isImportMeta = (node) => node?.type === "MetaProperty" && node.meta.name === "import" && node.property.name === "meta";

/**
 * Jest runs CommonJS, where `import.meta` does not exist. Vite's two uses in src/ become their test equivalents:
 * `import.meta.env` reads the values tests/support/setup.js defines, and `import.meta.glob` lists the files at run
 * time (so a new file is found without clearing Jest's cache).
 */
module.exports = function viteMetaPlugin({ types: t }) {
  return {
    name: "link-loom-vite-meta",
    visitor: {
      MemberExpression(nodePath) {
        const { node } = nodePath;
        if (!isImportMeta(node.object) || node.property.name !== "env") {
          return;
        }

        nodePath.replaceWith(t.memberExpression(t.identifier("globalThis"), t.identifier("__VITE_ENV__")));
      },
      CallExpression(nodePath) {
        const { callee } = nodePath.node;
        if (callee.type !== "MemberExpression" || !isImportMeta(callee.object) || callee.property.name !== "glob") {
          return;
        }

        const runtime = t.callExpression(t.identifier("require"), [t.stringLiteral(GLOB_RUNTIME)]);
        nodePath.replaceWith(
          t.callExpression(t.memberExpression(runtime, t.identifier("viteGlob")), [t.identifier("__dirname"), ...nodePath.node.arguments])
        );
      },
    },
  };
};

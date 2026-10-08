import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "../../src");

const filesUnder = (directory, suffix) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return filesUnder(fullPath, suffix);
    }

    return entry.name.endsWith(suffix) ? [fullPath] : [];
  });

// Pages are loaded by the route modules (lazily) and, for the not-found page, by App.jsx itself.
const routeSources = [...filesUnder(path.join(SRC, "routes"), ".jsx"), path.join(SRC, "App.jsx")].map((file) => fs.readFileSync(file, "utf8"));
const lazyPages = routeSources.flatMap((source) =>
  [...source.matchAll(/(?:import\(|from )"@pages\/([^"]+)"/g)].map((match) => match[1])
);

describe("routes", () => {
  it("load only pages that exist", () => {
    const missing = lazyPages.filter((page) => !fs.existsSync(path.join(SRC, "pages", `${page}.jsx`)));

    expect(missing).toEqual([]);
  });

  it("leave no page without a route", () => {
    const pages = filesUnder(path.join(SRC, "pages"), ".page.jsx").map((file) =>
      path.relative(path.join(SRC, "pages"), file).replace(/\.jsx$/, "").split(path.sep).join("/")
    );

    expect(pages.filter((page) => !lazyPages.includes(page))).toEqual([]);
  });

  it("collect every domain's routes", async () => {
    const { DomainRoutes } = await import("@routes/index");

    expect(DomainRoutes().length).toBe(filesUnder(path.join(SRC, "routes/domains"), ".routes.jsx").length);
  });
});

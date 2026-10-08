import { ALIASES } from "./aliases.config.js";

const aliasMapper = Object.fromEntries(
  Object.entries(ALIASES).map(([alias, target]) => [`^${alias}(/.*)?$`, `<rootDir>/${target}$1`])
);

/** Jest + React Testing Library. Tests live in tests/, mirroring src/. */
export default {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests"],
  setupFilesAfterEnv: ["<rootDir>/tests/support/setup.js"],
  transform: { "^.+\\.[jt]sx?$": "babel-jest" },
  moduleNameMapper: {
    ...aliasMapper,
    "^@tests/(.*)$": "<rootDir>/tests/$1",
    "\\.(css|scss)$": "identity-obj-proxy",
    "\\.(svg|png|jpe?g|gif|webp)$": "<rootDir>/tests/support/file-mock.js",
  },
  collectCoverageFrom: ["src/**/*.{js,jsx}", "!src/main.jsx"],
  ...(process.env.CI ? { coverageDirectory: "coverage", collectCoverage: true, reporters: ["default"] } : {}),
};

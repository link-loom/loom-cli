import { readDotenv } from '../../edits/dotenv.js';
import { SERVICES } from '../../services/catalog.js';
import { CHECK_SEVERITIES } from '../run.js';

// Every text file a secret could hide in, in any project type.
const TEXT_FILE = /\.(js|jsx|cjs|mjs|ts|tsx|astro|json|html|css|scss|md|mdx|txt|yml|yaml)$|(^|\/)\.env\.sample$/;

// Shapes of real credentials: a match in a versioned file is a leak.
const SECRET_SHAPES = [
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, label: 'a private key' },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/, label: 'an AWS access key' },
  { pattern: /\bAIza[0-9A-Za-z_-]{35}\b/, label: 'a Google API key' },
  { pattern: /\b(ghp|gho|ghs|github_pat)_[0-9A-Za-z_]{20,}\b/, label: 'a GitHub token' },
  { pattern: /\br8_[0-9A-Za-z]{30,}\b/, label: 'a Replicate token' },
  { pattern: /\bsk_live_[0-9A-Za-z]{16,}\b/, label: 'a live secret key' },
];

const SECRET_KEYS = Object.values(SERVICES).flatMap((service) =>
  service.env.filter((entry) => entry.secret).map((entry) => entry.key),
);

/** Files git keeps out: .env.local and whatever .gitignore names by exact path or simple pattern. */
const ignoredBy = (gitignore) => {
  const patterns = gitignore
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map(
      (line) =>
        new RegExp(
          `(^|/)${line
            .replace(/^\//, '')
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '[^/]*')}(/|$)`,
        ),
    );
  return (file) => patterns.some((pattern) => pattern.test(file));
};

export const secretsRule = {
  id: 'secrets',
  severity: CHECK_SEVERITIES.error,
  summary: 'No secret in a versioned file: keys live only in .env.local',
  run: (project) => {
    const ignored = ignoredBy(project.read('.gitignore') || '.env.local');
    const sample = readDotenv(project.read('.env.sample') || '');
    return [
      ...project.targets
        .filter((file) => TEXT_FILE.test(file) && !ignored(file) && file !== '.env.local')
        .flatMap((file) =>
          SECRET_SHAPES.filter((shape) => shape.pattern.test(project.read(file))).map((shape) => ({
            file,
            message: `Looks like ${shape.label}: move it to .env.local`,
          })),
        ),
      ...SECRET_KEYS.filter((key) => sample[key]).map((key) => ({
        file: '.env.sample',
        message: `${key} has a value: the sample keeps secrets empty`,
      })),
    ];
  },
};

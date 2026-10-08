# Agent evaluations

Can an agent with no context build a Link Loom project only with the CLI? Each case is a product brief (no technical
hints) and what the result must hold. When a case fails, the CLI is fixed (generators, schemas, descriptions,
skills, AGENTS.md, error messages), never the project; then the project is deleted and a new agent tries again.
Every iteration leaves its report in `runs/`.

```bash
# 1. A local registry with this monorepo and the SDK versions not published yet
npx -y verdaccio@6 --config evals/registry/config.yaml --listen 4873
node evals/registry.mjs --tarballs <folder with the SDK tarballs>

# 2. A new agent per case, in an empty folder outside every repository, allowed only the CLI, npm scripts and reads.
#    Launch it from your own terminal: Claude Code refuses to start inside another Claude Code session.
node evals/run.mjs miretail-workspace

# 3. The verdict: only the CLI, what the brief asked for, lint + check + tests + build
node evals/evaluate.mjs <the folder run.mjs printed>
```

Cases: `miretail-workspace`, `etrune-id-admin`, `sommatic-client`. They cost tokens: run them for each candidate
version, not on every commit. The inputs of a passing run become regression inputs for CI.

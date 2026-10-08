# sommatic-client: PASSED

- Work folder: `/tmp/loom-eval-sommatic-client-S4iN`
- Project: `/tmp/loom-eval-sommatic-client-S4iN`
- Tool calls: 19, turns: —, cost: — USD
- Tokens: —

## Only the CLI

- ✓ no hand edits

### CLI commands

- `source /tmp/loom-eval-npm-sommatic-client-AcoG/env.sh && cd /tmp/loom-eval-sommatic-client-S4iN && ls -la && npx @link-loom/cli --help`
- `source /tmp/loom-eval-npm-sommatic-client-AcoG/env.sh && cd /tmp/loom-eval-sommatic-client-S4iN && cat .case; npx @link-loom/cli describe --json 2>/dev/null`
- `source /tmp/loom-eval-npm-sommatic-client-AcoG/env.sh && cd /tmp/loom-eval-sommatic-client-S4iN && npx @link-loom/cli schema webapp 2>/dev/null`
- `source /tmp/loom-eval-npm-sommatic-client-AcoG/env.sh && cd /tmp/loom-eval-sommatic-client-S4iN && npx @link-loom/cli create --help 2>/dev/null; npx @link-loom/cli create webapp --help 2>/dev/null`
- `source /tmp/loom-eval-npm-sommatic-client-AcoG/env.sh && cd /tmp/loom-eval-sommatic-client-S4iN && npx @link-loom/cli create webapp --name "Sommatic" --variant client --description "The cognitive layer that interprets, decides and operates." --directory . --defaultLocale en --signup true --stoneos true --commandCenter true --platforms veripass,sommatic,vectry --primaryColor "#3a2e4f" --headerColor "#3a2e4f" --dry-run --json 2>/dev/null | head -150`
- `source /tmp/loom-eval-npm-sommatic-client-AcoG/env.sh && cd /tmp/loom-eval-sommatic-client-S4iN && npx @link-loom/cli create webapp --name "Sommatic" --variant client --description "The cognitive layer that interprets, decides and operates." --directory . --defaultLocale en --signup true --stoneos true --commandCenter true --platforms veripass,sommatic,vectry --primaryColor "#3a2e4f" --headerColor "#3a2e4f" --dry-run --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['warnings'], d['errors'], d['next']); print(len(d['plan']['create']))"`
- `source /tmp/loom-eval-npm-sommatic-client-AcoG/env.sh && cd /tmp/loom-eval-sommatic-client-S4iN && npx @link-loom/cli create webapp --name "Sommatic" --variant client --description "The cognitive layer that interprets, decides and operates." --directory . --defaultLocale en --signup true --stoneos true --commandCenter true --platforms veripass,sommatic,vectry --primaryColor "#3a2e4f" --headerColor "#3a2e4f" --json 2>/tmp/loom-eval-sommatic-client-S4iN.stderr.txt | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['ok'], d['warnings'], d['errors'], d['next']); print({k:v for k,v in d.items() if k not in ('plan','input')})" | head -40; tail -20 /tmp/loom-eval-sommatic-client-S4iN.stderr.txt`
- `source /tmp/loom-eval-npm-sommatic-client-AcoG/env.sh && cd /tmp/loom-eval-sommatic-client-S4iN && npx link-loom schema entity 2>/dev/null; cat loom.json`
- `source /tmp/loom-eval-npm-sommatic-client-AcoG/env.sh && cd /tmp/loom-eval-sommatic-client-S4iN && npx link-loom add entity --domain cognitive-infrastructure --entity agent --plural agents --singular-en "Agent" --plural-en "Agents" --singular-es "Agente" --plural-es "Agentes" --gender-es m --description-en "The agents of your organization." --description-es "Los agentes de tu organización." --fields name:text:required,objective:longtext,enabled:boolean:list --field-labels-en name=Name,objective=Objective,enabled=Enabled --field-labels-es name=Nombre,objective=Objetivo,enabled=Habilitado --list cards --actions quickview,copy-id --icon people --dry-run --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['ok'], d['warnings'], d['errors'], d['next']); print(json.dumps(d['input'],indent=1)); print(json.dumps(d['plan'],indent=1))"`
- `source /tmp/loom-eval-npm-sommatic-client-AcoG/env.sh && cd /tmp/loom-eval-sommatic-client-S4iN && npx link-loom add entity --domain cognitive-infrastructure --entity agent --plural agents --singular-en "Agent" --plural-en "Agents" --singular-es "Agente" --plural-es "Agentes" --gender-es m --description-en "The agents of your organization." --description-es "Los agentes de tu organización." --fields name:text:required,objective:longtext,enabled:boolean:list --field-labels-en name=Name,objective=Objective,enabled=Enabled --field-labels-es name=Nombre,objective=Objetivo,enabled=Habilitado --list cards --actions quickview,copy-id --icon people --json 2>&1 | python3 -c " import sys,json raw=sys.stdin.read() i=raw.find('{\n  \"schemaVersion\"') print(raw[:i][:2000]) d=json.loads(raw[i:]) print(d['ok'], d['warnings'], d['errors'], d['next'])"`
- `source /tmp/loom-eval-npm-sommatic-client-AcoG/env.sh && cd /tmp/loom-eval-sommatic-client-S4iN && npx link-loom add entity --domain cognitive-infrastructure --entity agent --plural agents --singular-en "Agent" --plural-en "Agents" --singular-es "Agente" --plural-es "Agentes" --gender-es m --description-en "The agents of your organization." --description-es "Los agentes de tu organización." --fields name:text:required,objective:longtext,enabled:boolean:list --field-labels-en name=Name,objective=Objective,enabled=Enabled --field-labels-es name=Nombre,objective=Objetivo,enabled=Habilitado --list cards --actions quickview,copy-id --icon people --yes --json 2>/dev/null | python3 -c " import sys,json d=json.load(sys.stdin) print(d['ok'], d['warnings'], d['errors'], d['next'])"`
- `source /tmp/loom-eval-npm-sommatic-client-AcoG/env.sh && cd /tmp/loom-eval-sommatic-client-S4iN && npm run verify >/dev/null 2>&1; echo "verify exit: $?"; npx link-loom check --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['ok'], d['errors'], d['warnings'])"; npx link-loom describe --project --json 2>/dev/null | head -80`

## What the brief asked for

- ✓ loom.json type
- ✓ loom.json variant
- ✓ loom.json name
- ✓ loom.json layers
- ✓ loom.json platforms
- ✓ loom.json brand.colors.header
- ✓ loom.json brand.colors.primary
- ✓ src/app.config.js has defaultLocale: "en"
- ✓ src/i18n/es.js has Agentes
- ✓ entity cognitive-infrastructure/agent

## Gates

- ✓ lint
- ✓ check
- ✓ test
- ✓ build

## The agent said

—

## Iteration notes

First run of this case: a fresh agent with no context (Sonnet subagent restricted to the CLI, because `claude -p` cannot
run inside Claude Code), against the local registry. It passed every expectation and every gate, with no file
written by hand. What the agents of this round (ÊTRUNE ID admin and Sommatic client) could not do or found
confusing, and what changed in the CLI:

- The webapp took one `--description`, so the Spanish dictionary repeated the English sentence (sign-in subtitle,
  app description). Added `--description-es`; without it the create warns.
- `add copy` could not rewrite a generated text (`E_TARGET_EXISTS` even with `--yes`). Added `--replace`; the
  conflict now says `Pass --replace --yes to rewrite it`.
- `schema entity` failed outside a project. `schema <generator>` now finds an `add` generator from anywhere and asks
  for `--type` when two project types have it.
- `create webapp --help` and `add entity --help` printed the global help. They now print that generator's flags,
  read from its schema.
- `EBADENGINE` on every call: `@babel/parser` 8 wants Node ≥ 22.18. The devkit uses 7.29 again (Node ≥ 22 works).
- The webapp build ships a 20 MB `vendor-ui` chunk (on purpose, to avoid cross-chunk circular imports): left as a
  separate task on the SDKs' tree-shaking.

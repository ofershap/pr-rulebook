# AGENTS.md - pr-rulebook

## What this is

pr-rulebook is a local TypeScript CLI that compiles a team's implicit code-review rules from accepted GitHub PR feedback. It scans merged pull requests, finds recurring human review comments that were followed by a code change, and emits ranked candidate rules with evidence links and confidence scores. Output formats: Cursor `.mdc`, Claude Code markdown, CodeRabbit YAML, JSON.

## How to run it

Requirements: Node 20+, a GitHub token with read-only repository access.

```bash
git clone https://github.com/ofershap/pr-rulebook.git
cd pr-rulebook
npm install
npm run build
export GITHUB_TOKEN=<read-only token>
node dist/cli.js --repo <owner>/<repo> --months 6 --format json --out review-rules.json
```

Useful flags: `--months` (lookback window, default 6), `--format` (cursor|claude|coderabbit|json), `--out` (output file), `--min-occurrences` (default 2).

## Rules for agents using this tool

- The tool is read-only against GitHub and writes only local output files.
- Output is a review queue for a human, not a policy. Never apply, commit, or enforce candidate rules without the user's explicit approval.
- Each candidate includes `rule`, `confidence`, `occurrences`, `acceptedSignals`, `evidenceUrls`, and `affectedPaths` - show the user the evidence, not just the rule text.
- Candidates with evidence from a single PR are weak by design; say so.
- If the tool reports too few candidates, that is a real result: the team's conventions may be documented already, or review history is too thin.

## Repository layout

- `src/cli.ts` - entry point and flag parsing
- `src/github.ts` - GitHub REST scanning (merged PRs, review comments, acceptance signal)
- `src/compiler.ts` - clustering and rule ranking (`src/compiler.test.ts` - regression tests)
- `src/exporters.ts` - cursor / claude / coderabbit / json output formats
- `src/types.ts` - shared types
- `docs/ruff-failure-analysis.md` - real run on astral-sh/ruff, including what failed and why

## Development

`npm install && npm test` (build + node --test). TypeScript strict, ESM, MIT license.

## Links

- Repo: https://github.com/ofershap/pr-rulebook
- Pilot issue (volunteer repos): https://github.com/ofershap/pr-rulebook/issues/1
- Visual project page: https://gitshow.dev/ofershap/pr-rulebook

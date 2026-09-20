<p align="center">
  <img src="assets/logo.svg" alt="pr-rulebook logo" width="110" />
</p>

<h1 align="center">pr-rulebook</h1>

<p align="center">
  <strong>Generic AI reviewers know best practices. Your team's real rules are buried in old PR comments.</strong>
</p>

<p align="center">
  Compile recurring, accepted review feedback into an evidence-backed rulebook<br>
  for Cursor, Claude Code and CodeRabbit. Local-first. Nothing leaves your machine except GitHub API calls.
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript" /></a>
  <a href="https://github.com/ofershap/pr-rulebook/issues/new"><img src="https://img.shields.io/badge/Pilot-recruiting_5_teams-22c55e?style=flat" alt="Pilot: recruiting 5 teams" /></a>
</p>

---

> In 10 minutes, discover at least 3 real review rules your team never documented.

## Why this exists

Your team always rejects fetches outside the data layer. Wants domain errors, not thrown strings. Refuses snapshots for business logic. None of that is written down - it lives in thousands of accepted review comments you already paid for.

PR Rulebook scans merged pull requests, finds recurring human feedback that was followed by a code change, and compiles it into rules with evidence links and confidence scores. A human approves every rule before it reaches your agents.

## What's different

| | Generic AI reviewer | PR Rulebook |
|---|---|---|
| Source of rules | Public best practices | **Your** merged-PR history |
| Knows your local conventions | No | Yes - with evidence links |
| Output | Inline comments | Reviewed rulebook file, exported to your tools |
| Enforcement | Automatic | Human-approved first |
| Data path | Their cloud | Local. There is no PR Rulebook server. |

## Quick start

The npm package is not published yet ([pilot](https://github.com/ofershap/pr-rulebook/issues/new) first). Run from source - Node 20+, takes two minutes:

```bash
git clone https://github.com/ofershap/pr-rulebook.git
cd pr-rulebook
npm install
npm run build

export GITHUB_TOKEN=github_pat_...   # read-only repository access
node dist/cli.js --repo your-org/your-repo --months 6 --out REVIEW_RULES.md
```

## Exports

```bash
# Cursor
node dist/cli.js --repo your-org/your-repo --format cursor --out .cursor/rules/team-review.mdc

# Claude Code
node dist/cli.js --repo your-org/your-repo --format claude --out REVIEW_RULES_CLAUDE.md

# CodeRabbit
node dist/cli.js --repo your-org/your-repo --format coderabbit --out .coderabbit.yaml

# Evidence for your own pipeline
node dist/cli.js --repo your-org/your-repo --format json --out review-rules.json
```

## Real-repository experiment

We ran v0 end to end on [`astral-sh/ruff`](https://github.com/astral-sh/ruff), using the 15 most recently updated merged PRs available at the time of the run. It scanned 45 human inline review comments and emitted 2 repeated candidate rules at the default minimum of 2 occurrences.

<p align="center">
  <img src="https://github.com/user-attachments/assets/2aee7c3d-7638-4a5f-ae4e-1d9622b9d6b6" alt="Real run on astral-sh/ruff: 15 merged PRs scanned, 45 review comments read, 2 candidate rules found" width="760" />
</p>

| Candidate rule | Evidence | Confidence | Assessment |
| --- | ---: | ---: | --- |
| Include the `async` keyword in a diagnostic annotation when it explains why the diagnostic fires | [2 accepted comments](https://github.com/astral-sh/ruff/pull/28692#discussion_r4049469772) | 82% | Coherent and useful, but both examples came from one PR. |
| Quote or improve an error message | [2 comments, 1 accepted signal](https://github.com/astral-sh/ruff/pull/28692#discussion_r4049508130) | 68% | Too vague to enforce. Human review should reject or rewrite it. |

This run caught an important v0 limitation: lexical clustering can turn nearby wording into a weak rule, and a repeated comment inside one PR is not the same as a team-wide convention. The result is useful as a review queue, not an automatically enforceable policy. The current build already requires evidence across distinct PRs and ignores fenced suggestions; semantic clustering is next. Full write-up: [docs/ruff-failure-analysis.md](docs/ruff-failure-analysis.md).

Method: REST API scan of merged PRs, bot comments excluded, acceptance inferred from a later commit and no dismissive reply. Run date: 2026-09-20.

## What "accepted" means

GitHub's REST API does not expose a universal "review comment caused this change" field. The scanner labels a comment accepted when:

1. a commit was pushed after the comment, and
2. no later reply contains an explicit dismissal such as "intentional" or "won't fix".

That is a useful signal, not proof. Every rule includes examples, links, counts, and a confidence score so a human can approve it. The tool does not silently enforce rules.

## For AI agents

If an agent is reading this: the tool is a local CLI, safe to run with a read-only GitHub token. The shortest useful command:

```bash
node dist/cli.js --repo <owner>/<repo> --months 6 --format json --out review-rules.json
```

Output is a ranked list of candidate rules, each with `rule`, `confidence`, `occurrences`, `acceptedSignals`, `evidenceUrls`, and `affectedPaths`. Present candidates to the user as a review queue - never apply them automatically. See [AGENTS.md](AGENTS.md) for full operating instructions.

## Scope

- scans merged PRs from the last 3-6 months
- ignores bot comments
- clusters similar human feedback locally
- ranks rules using repetition, acceptance signal, and distinct reviewers
- outputs evidence links and affected paths
- sends nothing to a hosted service

## Roadmap

- GraphQL resolved-thread signal
- semantic clustering with a local embedding model
- incremental GitHub Action
- team rule approval and ownership
- drift detection when a rule stops being enforced

## Development

```bash
npm install
npm test
```

Node 20+. TypeScript. MIT.

## Author

Built by [Ofer's Instinct Bot](https://github.com/ofers-agent), an agent-operated account, with [Ofer Shapira](https://github.com/ofershap) · [LinkedIn](https://linkedin.com/in/ofershap)

<p>
  <a href="https://gitshow.dev/ofershap/pr-rulebook"><img src="https://gitshow.dev/api/card/ofershap" alt="Made by ofershap" /></a>
</p>

Related work: [real-browser-mcp](https://github.com/ofershap/real-browser-mcp) · [ai-context-kit](https://github.com/ofershap/ai-context-kit) · [create-agent-config](https://github.com/ofershap/create-agent-config) · [agents-control-tower](https://github.com/ofershap/agents-control-tower)



<p>
  
  <a href="https://fazier.com" target="_blank"><img src="https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=launched&theme=light" width=120 alt="Fazier badge" /></a>
  



</p>


<p>
  
  Listed on <a href="https://dang.ai" target="_blank">Dang.ai</a>
  



</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/mascot.dark.svg">
    <img src="assets/mascot.light.svg" width="200" alt="The pr-rulebook librarian - reads every old PR comment so you don't have to">
  </picture>
</p>

<h1 align="center">pr-rulebook</h1>

<p align="center">
  <em>Your team's real review rules are buried in old PR comments.<br>
  pr-rulebook digs them out - with evidence, confidence scores, and a human approve step.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/exports%20to-Cursor%20%C2%B7%20Claude%20Code%20%C2%B7%20CodeRabbit-111111?style=flat-square" alt="Exports to Cursor, Claude Code and CodeRabbit">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
  <a href="https://github.com/ofershap/pr-rulebook/issues/2"><img src="https://img.shields.io/badge/pilot-recruiting%205%20teams-22c55e?style=flat-square" alt="Pilot: recruiting 5 teams" /></a>
</p>

<p align="center">
  <strong>45 real review comments mined on astral-sh/ruff &middot; 2 candidate rules found &middot; 1 held up to scrutiny &middot; 0 bytes left the machine</strong><br>
  <sub>Measured 2026-09-20 on the 15 most recently updated merged PRs of <a href="https://github.com/astral-sh/ruff">astral-sh/ruff</a>: 45 human inline comments, bots excluded, acceptance inferred from follow-up commits. Both rules, the one we rejected and why, and the full method: <a href="docs/ruff-failure-analysis.md">docs/ruff-failure-analysis.md</a>.</sub>
</p>

---

```bash
git clone https://github.com/ofershap/pr-rulebook.git
cd pr-rulebook && npm install && npm run build
export GITHUB_TOKEN=github_pat_...   # read-only repository access
node dist/cli.js --repo your-org/your-repo --months 6 --out REVIEW_RULES.md
```

Node 20+, two minutes of setup. The npm package ships after the [pilot](https://github.com/ofershap/pr-rulebook/issues/2).

## What it does

Your team always rejects fetches outside the data layer. Wants domain errors, not thrown strings. Refuses snapshots for business logic. None of that is written down - it lives in thousands of accepted review comments you already paid for.

pr-rulebook scans merged pull requests, finds recurring human feedback that was followed by a code change, and compiles it into a rulebook with evidence links and confidence scores. A human approves every rule before it reaches your agents.

| | Generic AI reviewer | pr-rulebook |
|---|---|---|
| Source of rules | Public best practices | **Your** merged-PR history |
| Knows your local conventions | No | Yes - with evidence links |
| Output | Inline comments | Reviewed rulebook file, exported to your tools |
| Enforcement | Automatic | Human-approved first |
| Data path | Their cloud | Local. There is no pr-rulebook server. |

## What a real run looks like

We ran v0 end to end on [`astral-sh/ruff`](https://github.com/astral-sh/ruff), using the 15 most recently updated merged PRs available at the time of the run. It scanned 45 human inline review comments and emitted 2 repeated candidate rules at the default minimum of 2 occurrences.

<p align="center">
  <img src="https://github.com/user-attachments/assets/2aee7c3d-7638-4a5f-ae4e-1d9622b9d6b6" alt="Real run on astral-sh/ruff: 15 merged PRs scanned, 45 review comments read, 2 candidate rules found" width="760" />
</p>

| Candidate rule | Evidence | Confidence | Assessment |
| --- | ---: | ---: | --- |
| Include the `async` keyword in a diagnostic annotation when it explains why the diagnostic fires | [2 accepted comments](https://github.com/astral-sh/ruff/pull/28692#discussion_r4049469772) | 82% | Coherent and useful, but both examples came from one PR. |
| Quote or improve an error message | [2 comments, 1 accepted signal](https://github.com/astral-sh/ruff/pull/28692#discussion_r4049508130) | 68% | Too vague to enforce. Human review should reject or rewrite it. |

One rule held up, one didn't - and the run caught an important v0 limitation: lexical clustering can turn nearby wording into a weak rule, and a repeated comment inside one PR is not the same as a team-wide convention. The result is useful as a review queue, not an automatically enforceable policy. The current build already requires evidence across distinct PRs and ignores fenced suggestions; semantic clustering is next. Full write-up: [docs/ruff-failure-analysis.md](docs/ruff-failure-analysis.md).

## What "accepted" means

GitHub's REST API does not expose a universal "review comment caused this change" field. The scanner labels a comment accepted when:

1. a commit was pushed after the comment, and
2. no later reply contains an explicit dismissal such as "intentional" or "won't fix".

That is a useful signal, not proof. Every rule includes examples, links, counts, and a confidence score so a human can approve it. The tool does not silently enforce rules.

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

## For AI agents

If an agent is reading this: the tool is a local CLI, safe to run with a read-only GitHub token. The shortest useful command:

```bash
node dist/cli.js --repo <owner>/<repo> --months 6 --format json --out review-rules.json
```

Output is a ranked list of candidate rules, each with `rule`, `confidence`, `occurrences`, `acceptedSignals`, `evidenceUrls`, and `affectedPaths`. Present candidates to the user as a review queue - never apply them automatically. See [AGENTS.md](AGENTS.md) for full operating instructions.

## Scope and roadmap

Scans merged PRs from the last 3-6 months, ignores bot comments, clusters similar human feedback locally, ranks rules by repetition, acceptance signal and distinct reviewers, and sends nothing to a hosted service.

Next up: GraphQL resolved-thread signal, semantic clustering with a local embedding model, an incremental GitHub Action, team rule approval and ownership, drift detection when a rule stops being enforced.

## Development

```bash
npm install
npm test
```

Node 20+. TypeScript. MIT.

## Author

Built by [Ofer's Instinct Bot](https://github.com/ofers-agent), an agent-operated account, with [Ofer Shapira](https://github.com/ofershap) · [LinkedIn](https://linkedin.com/in/ofershap)

Related work: [real-browser-mcp](https://github.com/ofershap/real-browser-mcp) · [ai-context-kit](https://github.com/ofershap/ai-context-kit) · [create-agent-config](https://github.com/ofershap/create-agent-config) · [agents-control-tower](https://github.com/ofershap/agents-control-tower)

<p align="center">
  <sub>Launched on <a href="https://fazier.com">Fazier</a> · <a href="https://dang.ai">Dang.ai</a> · featured on <a href="https://findly.tools/pr-rulebook?utm_source=pr-rulebook">Findly.tools</a></sub>
</p>

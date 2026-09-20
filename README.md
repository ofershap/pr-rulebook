# PR Rulebook

**Your team already has code-review rules. They are just buried in old PR comments.**

PR Rulebook scans merged pull requests, finds recurring human review feedback that was followed by a code change, and compiles it into a review rulebook with evidence and confidence scores. Export the result to Cursor, Claude Code, or CodeRabbit.

> In 10 minutes, discover at least 3 real review rules your team never documented.

## Why this exists

Generic AI reviewers know common best practices. They do not know that your team always rejects fetches outside the data layer, wants domain errors instead of thrown strings, or refuses snapshots for business logic. PR Rulebook learns those local rules from the review history you already paid for.

The scanner runs locally. Your code and review comments go directly from GitHub to your machine. There is no PR Rulebook server.

## Quick start

```bash
export GITHUB_TOKEN=github_pat_... # read-only repository access
npx pr-rulebook --repo acme/web --months 6 --out REVIEW_RULES.md
```

The npm package is not published yet. For the pilot, clone the repository and run the source checkout below. A public `npx github:...` install is not available because the agent-owned repository currently requires GitHub authentication.

For this source checkout:

```bash
npm install
npm run build
node dist/cli.js --repo acme/web --months 6 --out REVIEW_RULES.md
```

## Exports

```bash
# Cursor
pr-rulebook --repo acme/web --format cursor --out .cursor/rules/team-review.mdc

# Claude Code
pr-rulebook --repo acme/web --format claude --out REVIEW_RULES_CLAUDE.md

# CodeRabbit
pr-rulebook --repo acme/web --format coderabbit --out .coderabbit.yaml

# Evidence for your own pipeline
pr-rulebook --repo acme/web --format json --out review-rules.json
```

## Real-repository experiment

We ran v0 end to end on [`astral-sh/ruff`](https://github.com/astral-sh/ruff), using the 15 most recently updated merged PRs available at the time of the run. It scanned 45 human inline review comments and emitted 2 repeated candidate rules at the default minimum of 2 occurrences.

| Candidate rule | Evidence | Confidence | Assessment |
| --- | ---: | ---: | --- |
| Include the `async` keyword in a diagnostic annotation when it explains why the diagnostic fires | [2 accepted comments](https://github.com/astral-sh/ruff/pull/28692#discussion_r4049469772) | 82% | Coherent and useful, but both examples came from one PR. |
| Quote or improve an error message | [2 comments, 1 accepted signal](https://github.com/astral-sh/ruff/pull/28692#discussion_r4049508130) | 68% | Too vague to enforce. Human review should reject or rewrite it. |

This run caught an important v0 limitation: lexical clustering can turn nearby wording into a weak rule, and a repeated comment inside one PR is not the same as a team-wide convention. The result is useful as a review queue, not an automatically enforceable policy. Next, rules should require evidence across distinct PRs and use semantic clustering.

Method: REST API scan of merged PRs, bot comments excluded, acceptance inferred from a later commit and no dismissive reply. Run date: 2026-09-20.

## What "accepted" means in v0

GitHub's REST API does not expose a universal "review comment caused this change" field. v0 labels a comment accepted when:

1. a commit was pushed after the comment, and
2. no later reply contains an explicit dismissal such as "intentional" or "won't fix".

That is a useful signal, not proof. Every rule includes examples, links, counts, and a confidence score so a human can approve it. The tool does not silently enforce rules.

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

Related work from [Ofer Shapira](https://github.com/ofershap): [ai-context-kit](https://github.com/ofershap/ai-context-kit), [create-agent-config](https://github.com/ofershap/create-agent-config), and [agents-control-tower](https://github.com/ofershap/agents-control-tower).


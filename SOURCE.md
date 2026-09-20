# Source snapshot (v0)

The files below are the tested TypeScript implementation. Split each fenced block by its heading for local development.

## `package.json`

```json
{
  "name": "pr-rulebook",
  "version": "0.1.0",
  "description": "Compile a team's implicit code-review rules from GitHub PR history.",
  "type": "module",
  "bin": { "pr-rulebook": "dist/cli.js" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "npm run build && node --test dist/*.test.js",
    "start": "node dist/cli.js"
  },
  "engines": { "node": ">=20" },
  "keywords": ["code-review", "github", "cursor", "claude-code", "coderabbit", "developer-tools"],
  "license": "MIT",
  "devDependencies": { "@types/node": "^24.0.0", "typescript": "^5.9.0" }
}

```

## `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
    "outDir": "dist", "rootDir": "src", "strict": true, "skipLibCheck": true,
    "declaration": true, "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}

```

## `src/types.ts`

```ts
export interface CommentSample {
  id: number; body: string; author: string; url: string; path: string;
  createdAt: string; pr: number; accepted: boolean; acceptanceReason: string;
}
export interface Rule {
  id: string; title: string; instruction: string; confidence: number;
  occurrences: number; accepted: number; files: string[]; examples: CommentSample[];
}
export interface ScanResult {
  repository: string; since: string; generatedAt: string; prsScanned: number;
  commentsScanned: number; rules: Rule[]; caveats: string[];
}

```

## `src/github.ts`

```ts
import type { CommentSample } from './types.js';

const API = 'https://api.github.com';
export class GitHubClient {
  constructor(private token: string) {}
  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${API}${path}`, { headers: {
      Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'pr-rulebook'
    }});
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }
  async collect(repo: string, since: string, maxPrs: number): Promise<{samples: CommentSample[]; prs: number}> {
    type PR = {number:number; merged_at:string|null; user:{login:string;type:string}};
    type ReviewComment = {id:number;body:string;html_url:string;path:string;created_at:string;user:{login:string;type:string}};
    type IssueComment = {id:number;body:string;html_url:string;created_at:string;user:{login:string;type:string}};
    type Commit = {commit:{author:{date:string}|null}};
    const prs = await this.request<PR[]>(`/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=${Math.min(maxPrs,100)}`);
    const eligible = prs.filter(p => p.merged_at && p.merged_at >= since).slice(0,maxPrs);
    const out: CommentSample[] = [];
    for (const pr of eligible) {
      const [reviews, issues, commits] = await Promise.all([
        this.request<ReviewComment[]>(`/repos/${repo}/pulls/${pr.number}/comments?per_page=100`),
        this.request<IssueComment[]>(`/repos/${repo}/issues/${pr.number}/comments?per_page=100`),
        this.request<Commit[]>(`/repos/${repo}/pulls/${pr.number}/commits?per_page=100`)
      ]);
      const commitDates = commits.map(c => c.commit.author?.date).filter(Boolean) as string[];
      const replies = [...reviews, ...issues];
      for (const c of reviews) {
        if (c.user.type === 'Bot' || /\[bot\]$/.test(c.user.login) || c.body.length < 18) continue;
        const laterCommit = commitDates.some(date => date > c.created_at);
        const rejected = replies.some(r => r.created_at > c.created_at && /\b(won't|wont|disagree|not needed|intentional|as designed)\b/i.test(r.body));
        out.push({ id:c.id, body:c.body.trim(), author:c.user.login, url:c.html_url, path:c.path,
          createdAt:c.created_at, pr:pr.number, accepted:laterCommit && !rejected,
          acceptanceReason: laterCommit ? (rejected ? 'later commit, but a dismissive reply was found' : 'a later commit followed the comment') : 'no later commit signal' });
      }
    }
    return {samples: out, prs: eligible.length};
  }
}

```

## `src/compiler.ts`

```ts
import { createHash } from 'node:crypto';
import type { CommentSample, Rule } from './types.js';

const STOP = new Set('the a an and or but to of in on for with this that it is are be we you i should could would can please here there from as at by if when use using'.split(' '));
export function normalize(body: string): string[] {
  return body.toLowerCase().replace(/`[^`]+`/g,' code ').replace(/https?:\/\/\S+/g,' ')
    .replace(/[^a-z0-9_ -]/g,' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
}
function similarity(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a,...b]).size;
  return union ? intersection / union : 0;
}
function imperative(samples: CommentSample[]): string {
  const shortest = [...samples].sort((a,b)=>a.body.length-b.body.length)[0].body.replace(/\s+/g,' ');
  return shortest.length > 180 ? shortest.slice(0,177)+'...' : shortest;
}
export function compile(samples: CommentSample[], minOccurrences=2): Rule[] {
  const clusters: CommentSample[][] = [];
  for (const sample of samples) {
    const words = new Set(normalize(sample.body));
    let best=-1, score=0;
    clusters.forEach((cluster,i)=>{ const s=similarity(words,new Set(cluster.flatMap(x=>normalize(x.body)))); if(s>score){score=s;best=i;} });
    if (score >= 0.28) clusters[best].push(sample); else clusters.push([sample]);
  }
  return clusters.filter(c=>c.length>=minOccurrences).map(c=>{
    const accepted=c.filter(x=>x.accepted).length;
    const acceptanceRate=accepted/c.length;
    const authors=new Set(c.map(x=>x.author)).size;
    const confidence=Math.min(.99, .35 + Math.min(c.length,6)*.07 + acceptanceRate*.28 + Math.min(authors,3)*.05);
    const instruction=imperative(c);
    return { id:createHash('sha1').update(instruction).digest('hex').slice(0,8), title:instruction.replace(/[.!?].*$/,'').slice(0,80),
      instruction, confidence:Number(confidence.toFixed(2)), occurrences:c.length, accepted, files:[...new Set(c.map(x=>x.path))].slice(0,8), examples:c.slice(0,3)};
  }).sort((a,b)=>b.confidence-a.confidence || b.occurrences-a.occurrences);
}

```

## `src/exporters.ts`

```ts
import type { ScanResult } from './types.js';
const lines = (r: ScanResult) => r.rules.map((x,i)=>`${i+1}. ${x.instruction}\n   Evidence: ${x.occurrences} comments, ${x.accepted} accepted signals, confidence ${Math.round(x.confidence*100)}%`).join('\n');
export function markdown(r: ScanResult) { return `# Review rulebook\n\nGenerated from ${r.repository} PR history on ${r.generatedAt}.\n\n${lines(r)}\n\n## Method caveat\nAcceptance is inferred from a later commit after a review comment and absence of an explicit dismissive reply. Review these rules before enforcing them.\n`; }
export function cursor(r: ScanResult) { return `---\ndescription: Team review rules compiled from accepted PR feedback\nalwaysApply: true\n---\n\n# Team review rules\n\n${lines(r)}\n`; }
export function claude(r: ScanResult) { return `\n<!-- pr-rulebook:start -->\n## Team review rules\n${lines(r)}\n<!-- pr-rulebook:end -->\n`; }
export function coderabbit(r: ScanResult) { return `reviews:\n  path_instructions:\n${r.rules.map(x=>`    - path: "${x.files[0] ?? '**/*'}"\n      instructions: |\n        ${x.instruction.replace(/\n/g,' ')}\n        Evidence: ${x.occurrences} historical comments; confidence ${Math.round(x.confidence*100)}%.`).join('\n')}\n`; }

```

## `src/cli.ts`

```ts
#!/usr/bin/env node
import { mkdir, writeFile, appendFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { GitHubClient } from './github.js';
import { compile } from './compiler.js';
import { markdown, cursor, claude, coderabbit } from './exporters.js';
import type { ScanResult } from './types.js';

const args=process.argv.slice(2); const get=(key:string, fallback?:string)=>{const i=args.indexOf(key); return i>=0?args[i+1]:fallback};
if(args.includes('--help')||!get('--repo')) { console.log(`pr-rulebook --repo owner/name [--months 6] [--max-prs 100] [--min-occurrences 2] [--format markdown|json|cursor|claude|coderabbit] [--out file]\n\nRequires GITHUB_TOKEN with read access to the repository.`); process.exit(args.includes('--help')?0:1); }
const repo=get('--repo')!; const months=Number(get('--months','6')); const maxPrs=Number(get('--max-prs','100')); const min=Number(get('--min-occurrences','2'));
const token=process.env.GITHUB_TOKEN; if(!token) throw new Error('Set GITHUB_TOKEN. The token is used locally and never uploaded.');
const sinceDate=new Date(); sinceDate.setMonth(sinceDate.getMonth()-months); const since=sinceDate.toISOString();
console.error(`Scanning merged PRs in ${repo} since ${since.slice(0,10)}...`);
const data=await new GitHubClient(token).collect(repo,since,maxPrs);
const result:ScanResult={repository:repo,since,generatedAt:new Date().toISOString(),prsScanned:data.prs,commentsScanned:data.samples.length,rules:compile(data.samples,min),caveats:['Acceptance is inferred, not proven: later commit after comment and no dismissive reply.','Human review is required before enforcement.']};
const format=get('--format','markdown')!; const output=format==='json'?JSON.stringify(result,null,2):format==='cursor'?cursor(result):format==='claude'?claude(result):format==='coderabbit'?coderabbit(result):markdown(result);
const out=get('--out'); if(out){await mkdir(dirname(resolve(out)),{recursive:true}); if(format==='claude'&&args.includes('--append')) await appendFile(out,output); else await writeFile(out,output); console.error(`Wrote ${result.rules.length} rules to ${out}`);} else console.log(output);
if(result.rules.length<3) console.error(`Found ${result.rules.length} repeated rules. Try a longer window or --min-occurrences 1 for a diagnostic pass.`);

```

## `src/compiler.test.ts`

```ts
import test from 'node:test'; import assert from 'node:assert/strict'; import {compile,normalize} from './compiler.js'; import type {CommentSample} from './types.js';
const s=(id:number,body:string,accepted=true):CommentSample=>({id,body,accepted,author:`u${id}`,url:'https://example.test',path:'src/a.ts',createdAt:'2026-01-01',pr:id,acceptanceReason:'test'});
test('normalizes review prose',()=>assert.deepEqual(normalize('Please use `const x` here!'),['code']));
test('clusters similar recurring comments',()=>{const r=compile([s(1,'Please add error handling for this request'),s(2,'Add error handling for the request path')]); assert.equal(r.length,1); assert.equal(r[0].occurrences,2);});

```

## `LICENSE`

```text
MIT License

Copyright (c) 2026 Ofer Shapira and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

```

## `.gitignore`

```gitignore
node_modules/
dist/
.env
*.log
.DS_Store

```

## `docs/index.html`

```html
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PR Rulebook - uncover the rules your team already enforces</title><meta name="description" content="Compile recurring accepted PR feedback into review rules for Cursor, Claude Code and CodeRabbit."><style>
:root{--ink:#172018;--muted:#566057;--paper:#f6f2e8;--acid:#d7ff4f;--line:#c9c4b8}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}main{max-width:1080px;margin:auto;padding:28px}.nav{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:18px}.brand{font-weight:900}.tag{font-size:12px;border:1px solid;padding:5px 9px;border-radius:99px}.hero{display:grid;grid-template-columns:1.2fr .8fr;gap:70px;padding:100px 0 80px}h1{font-family:Arial,sans-serif;font-size:clamp(46px,7vw,88px);line-height:.94;letter-spacing:-.055em;margin:0 0 28px;max-width:820px}.mark{background:var(--acid);padding:0 .08em}p.lead{font-size:20px;max-width:650px;color:var(--muted)}.actions{display:flex;gap:12px;margin-top:34px;flex-wrap:wrap}.btn{display:inline-block;color:var(--ink);text-decoration:none;border:2px solid var(--ink);padding:13px 18px;font-weight:800}.primary{background:var(--ink);color:white}.terminal{background:#172018;color:#eef7df;padding:24px;box-shadow:14px 14px 0 var(--acid);align-self:center;overflow:auto}.terminal .dim{color:#9eaa9f}.grid{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line);border-left:1px solid var(--line)}.card{padding:30px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);min-height:230px}.num{color:#7a817a}.card h2{font-family:Arial,sans-serif;font-size:24px}.proof{margin:90px 0;background:white;border:1px solid var(--line);padding:48px;display:grid;grid-template-columns:1fr 1fr;gap:50px}.proof h2{font:700 40px/1 Arial,sans-serif;margin:0}.rule{border-left:5px solid var(--acid);padding-left:18px}.small{font-size:13px;color:var(--muted)}footer{padding:40px 0 20px;border-top:1px solid var(--line);display:flex;justify-content:space-between}@media(max-width:800px){.hero,.proof{grid-template-columns:1fr}.hero{padding:65px 0}.grid{grid-template-columns:1fr}h1{font-size:52px}.terminal{margin-right:14px}}
</style></head><body><main><nav class="nav"><div class="brand">PR RULEBOOK</div><div class="tag">OPEN SOURCE · LOCAL FIRST</div></nav><section class="hero"><div><h1>Your team has rules. <span class="mark">They're buried in PRs.</span></h1><p class="lead">Compile recurring, accepted review feedback into a rulebook for Cursor, Claude Code and CodeRabbit. Evidence included.</p><div class="actions"><a class="btn primary" href="https://github.com/ofershap/pr-rulebook">View on GitHub →</a><a class="btn" href="#how">How it works</a></div></div><div class="terminal"><span class="dim">$</span> npx pr-rulebook --repo acme/web<br><br><span class="dim">✓</span> scanned 84 merged PRs<br><span class="dim">✓</span> read 1,247 human comments<br><span class="dim">✓</span> found <b>7 repeated rules</b><br><br><span class="dim">→</span> .cursor/rules/team-review.mdc</div></section><section id="how" class="grid"><div class="card"><span class="num">01</span><h2>Scan locally</h2><p>Read-only GitHub access. Code and comments never pass through our server because there is no server.</p></div><div class="card"><span class="num">02</span><h2>Find the pattern</h2><p>Cluster repeated human feedback and rank it using code-change signals, reviewers and frequency.</p></div><div class="card"><span class="num">03</span><h2>Ship the rulebook</h2><p>Export reviewed rules to the coding agents and reviewers your team already uses.</p></div></section><section class="proof"><div><h2>Three undocumented rules in ten minutes.</h2><p>That is the bar. If your team's PR history cannot produce useful rules, the tool should say so.</p></div><div class="rule"><b>Avoid network calls in React components.</b><p class="small">11 occurrences · 9 accepted-change signals · 91% confidence</p><p>Examples link back to the exact review comments. A human approves before enforcement.</p></div></section><footer><span>MIT licensed. Built for teams with opinions.</span><a href="https://github.com/ofershap">Ofer's related tools ↗</a></footer></main></body></html>

```


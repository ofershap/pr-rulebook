#!/usr/bin/env node
import { mkdir, writeFile, appendFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { GitHubClient } from './github.js';
import { compile } from './compiler.js';
import { markdown, cursor, claude, coderabbit } from './exporters.js';
import type { ScanResult } from './types.js';

const args=process.argv.slice(2); const get=(key:string, fallback?:string)=>{const i=args.indexOf(key); return i>=0?args[i+1]:fallback};
if(args.includes('--help')||!get('--repo')) { console.log(`pr-rulebook --repo owner/name [--months 6] [--max-prs 100] [--min-occurrences 2] [--min-prs 2] [--format markdown|json|cursor|claude|coderabbit] [--out file]\n\nRequires GITHUB_TOKEN with read access to the repository.`); process.exit(args.includes('--help')?0:1); }
const repo=get('--repo')!; const months=Number(get('--months','6')); const maxPrs=Number(get('--max-prs','100')); const min=Number(get('--min-occurrences','2')); const minPrs=Number(get('--min-prs','2'));
const token=process.env.GITHUB_TOKEN ?? '';
const sinceDate=new Date(); sinceDate.setMonth(sinceDate.getMonth()-months); const since=sinceDate.toISOString();
console.error(`Scanning merged PRs in ${repo} since ${since.slice(0,10)}...`);
const data=await new GitHubClient(token).collect(repo,since,maxPrs);
const result:ScanResult={repository:repo,since,generatedAt:new Date().toISOString(),prsScanned:data.prs,commentsScanned:data.samples.length,rules:compile(data.samples,min,minPrs),caveats:['Acceptance is inferred, not proven: later commit after comment and no dismissive reply.','Human review is required before enforcement.']};
const format=get('--format','markdown')!; const output=format==='json'?JSON.stringify(result,null,2):format==='cursor'?cursor(result):format==='claude'?claude(result):format==='coderabbit'?coderabbit(result):markdown(result);
const out=get('--out'); if(out){await mkdir(dirname(resolve(out)),{recursive:true}); if(format==='claude'&&args.includes('--append')) await appendFile(out,output); else await writeFile(out,output); console.error(`Wrote ${result.rules.length} rules to ${out}`);} else console.log(output);
if(result.rules.length<3) console.error(`Found ${result.rules.length} repeated rules. Try a longer window or --min-occurrences 1 for a diagnostic pass.`);

import { createHash } from 'node:crypto';
import type { CommentSample, Rule } from './types.js';

const STOP = new Set('the a an and or but to of in on for with this that it is are be we you i should could would can please here there from as at by if when use using same also just think feel quite'.split(' '));
const CANONICAL: Record<string,string> = {
  msg:'message', messages:'message', errors:'error', diagnostic:'error', diagnostics:'error',
  quote:'quote', quoted:'quote', quoting:'quote', improve:'improve', improved:'improve',
  annotation:'range', annotations:'range', include:'range', includes:'range', extend:'range',
  extends:'range', async:'async', await:'async', coroutine:'async',
};
export function normalize(body: string): string[] {
  return body.toLowerCase().replace(/```[\s\S]*?```/g,' ').replace(/`([^`]+)`/g,' $1 ').replace(/https?:\/\/\S+/g,' ')
    .replace(/[^a-z0-9_ -]/g,' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(w=>CANONICAL[w] ?? w);
}
function vector(words:string[]):Map<string,number>{const v=new Map<string,number>(); for(const w of words)v.set(w,(v.get(w)??0)+1); return v;}
function similarity(a: string[], b: string[]): number {
  const av=vector(a), bv=vector(b); let dot=0,aa=0,bb=0;
  for(const n of av.values())aa+=n*n; for(const n of bv.values())bb+=n*n;
  for(const [w,n] of av)dot+=n*(bv.get(w)??0);
  return aa&&bb ? dot/Math.sqrt(aa*bb) : 0;
}
function imperative(samples: CommentSample[]): string {
  const shortest = [...samples].sort((a,b)=>a.body.length-b.body.length)[0].body.replace(/```[\s\S]*?```/g,'').replace(/\s+/g,' ').trim();
  return shortest.length > 180 ? shortest.slice(0,177)+'...' : shortest;
}
export function compile(samples: CommentSample[], minOccurrences=2, minDistinctPrs=2): Rule[] {
  const clusters: CommentSample[][] = [];
  for (const sample of samples) {
    const words=normalize(sample.body); let best=-1, score=0;
    clusters.forEach((cluster,i)=>{ const s=similarity(words,cluster.flatMap(x=>normalize(x.body))); if(s>score){score=s;best=i;} });
    if (score >= 0.42) clusters[best].push(sample); else clusters.push([sample]);
  }
  return clusters.filter(c=>c.length>=minOccurrences && new Set(c.map(x=>x.pr)).size>=minDistinctPrs).map(c=>{
    const accepted=c.filter(x=>x.accepted).length; const acceptanceRate=accepted/c.length;
    const authors=new Set(c.map(x=>x.author)).size; const prs=new Set(c.map(x=>x.pr)).size;
    const confidence=Math.min(.99, .30 + Math.min(c.length,6)*.06 + acceptanceRate*.25 + Math.min(authors,3)*.05 + Math.min(prs,3)*.06);
    const instruction=imperative(c);
    return { id:createHash('sha1').update(instruction).digest('hex').slice(0,8), title:instruction.replace(/[.!?].*$/,'').slice(0,80),
      instruction, confidence:Number(confidence.toFixed(2)), occurrences:c.length, accepted, distinctPrs:prs, files:[...new Set(c.map(x=>x.path))].slice(0,8), examples:c.slice(0,3)};
  }).sort((a,b)=>b.confidence-a.confidence || b.occurrences-a.occurrences);
}

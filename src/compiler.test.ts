import test from 'node:test'; import assert from 'node:assert/strict'; import {compile,normalize} from './compiler.js'; import type {CommentSample} from './types.js';
const s=(id:number,body:string,pr=id,accepted=true):CommentSample=>({id,body,accepted,author:`u${id}`,url:'https://example.test',path:'src/a.ts',createdAt:'2026-01-01',pr,acceptanceReason:'test'});
test('normalizes prose, aliases and fenced suggestions',()=>assert.deepEqual(normalize('Please improve the `error msg`!\n```suggestion\nignored code\n```'),['improve','error','message']));
test('clusters meaning-equivalent feedback across PRs',()=>{const r=compile([s(1,'Please improve the error message'),s(2,'This diagnostic message needs improvement')]); assert.equal(r.length,1); assert.equal(r[0].distinctPrs,2);});
test('rejects repetition confined to one PR',()=>assert.equal(compile([s(1,'Quote the error message',7),s(2,'Please quote this error msg',7)]).length,0));


import {describe,it,expect} from 'vitest';
import {evaluateUiSource,checkTargetAssets,type typUiRule} from '../../../scripts/target-ui-guardrails.js';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
interface intfFixture {readonly rule:typUiRule;readonly path:string;readonly bad:string;readonly good:string}
const fixtures:readonly intfFixture[]=[
  {rule:'UI01',path:'apps/web/package.json',bad:'{"dependencies":{"tailwindcss":"4.0.0"}}',good:'{"dependencies":{"bootstrap":"5.3.8"}}'},
  {rule:'UI02',path:'apps/web/src/lib/view.ts',bad:'export function load(){return fetch("/api/data")}',good:'export function load(client:{request:()=>void}){client.request()}'},
  {rule:'UI03',path:'apps/web/src/lib/view.ts',bad:'export const admin = user.role === "admin";',good:'export const label = user.role;'},
  {rule:'UI04',path:'apps/web/src/lib/view.ts',bad:'import picker from "jalaali-js";',good:'import {toJalali} from "@targoman/calendar-core";'},
  {rule:'UI05',path:'apps/web/src/lib/View.svelte',bad:'<p>{@html unsafe}</p>',good:'<p>{safeText}</p>'},
  {rule:'UI06',path:'apps/web/src/lib/view.ts',bad:'import pg from "pg";',good:'import type {intfCursorPage} from "@targoman/contracts";'},
  {rule:'UI07',path:'apps/web/src/lib/view.ts',bad:'import {SECRET} from "$env/static/private";',good:'export const safe = 1;'},
  {rule:'UI08',path:'apps/web/src/lib/view.ts',bad:'const width = window.innerWidth;',good:'function readWidth(){return window.innerWidth;}'},
  {rule:'UI09',path:'apps/web/src/lib/view.ts',bad:'export const title="Targoman";',good:'export const title=brand.displayName;'},
  {rule:'UI10',path:'apps/web/src/lib/view.ts',bad:'export const base="https://customer.example.com/app";',good:'export const base=binding.basePath;'},
  {rule:'UI11',path:'apps/web/src/lib/View.svelte',bad:'<a href="javascript:alert(1)">bad</a>',good:'<a href="/safe">safe</a>'},
  {rule:'UI12',path:'apps/web/src/lib/view.ts',bad:'export type typBad=any;',good:'export type typGood=unknown;'},
  {rule:'UI13',path:'apps/web/src/lib/view.ts',bad:'type typBad=Component<any>;',good:'type typGood={key:"title";props:{text:string}};'},
  {rule:'UI14',path:'packages/contracts/src/index.ts',bad:'export interface intfCursorPage<T>{items:T[];total:number}',good:'export interface intfCursorPage<T>{items:T[];hasMore:boolean;nextCursor:string|null}'},
  {rule:'UI15',path:'apps/web/src/lib/styles/view.scss',bad:'.hidden { display:none !important }',good:'.component { padding-inline:1rem }'},
  {rule:'UI16',path:'apps/web/src/lib/view.ts',bad:'localStorage.setItem("token",secret);',good:'document.cookie="ui-theme=dark";'},
  {rule:'UI19',path:'apps/web/package.json',bad:'{"name":"@fapa/web"}',good:'{"name":"@targoman/web"}'},
  {rule:'UI20',path:'apps/web/src/routes/+layout.svelte',bad:'<strong>FAPA</strong>',good:'<strong>{brand.displayName}</strong>'},
  {rule:'UI21',path:'apps/web/package.json',bad:'{"name":"@targoman/web","dependencies":{"lucide-svelte":"1.0.0"}}',good:'{"name":"@targoman/web","dependencies":{"bootstrap":"5.3.8"}}'},
  {rule:'UI23',path:'apps/web/src/routes/+layout.svelte',bad:'<nav><a>Home</a></nav>',good:'<nav><a>{i18n.t("home")}</a></nav>'},
  {rule:'UI24',path:'apps/web/src/routes/(public)/foundation/+page.server.ts',bad:'export const load=()=>({});',good:'export const load=()=>{requireDevelopmentShowcase(import.meta.env.DEV);return {};};'}
];
describe('UI01–UI21 guardrail fixtures',()=>{
  for(const fixture of fixtures){it(`${fixture.rule} rejects unsafe source and accepts scoped source`,()=>{
    expect(evaluateUiSource(fixture.path,fixture.bad).some(item=>item.rule===fixture.rule)).toBe(true);
    expect(evaluateUiSource(fixture.path,fixture.good).some(item=>item.rule===fixture.rule)).toBe(false);
  });}
});
it('does not treat content fixtures as framework localization violations',()=>{
  expect(evaluateUiSource('apps/web/src/routes/(public)/foundation/+page.svelte','<p>Home</p>').some(item=>item.rule==='UI23')).toBe(false);
});
it('rejects package-derived visual identity and interactive emoji icons',()=>{
  expect(evaluateUiSource('packages/branding/package.json','{"name":"@client-a/branding"}').some(item=>item.rule==='UI19')).toBe(true);
  expect(evaluateUiSource('apps/web/src/routes/+layout.svelte','<script>const displayName=packageJson.name;</script><strong>{displayName}</strong>').some(item=>item.rule==='UI20')).toBe(true);
  expect(evaluateUiSource('apps/web/src/routes/+layout.svelte','<button>🔍</button>').some(item=>item.rule==='UI21')).toBe(true);
  expect(evaluateUiSource('apps/web/src/routes/+layout.svelte','<button aria-label="Search"><i class="fa-solid fa-search" aria-hidden="true"></i></button>').some(item=>item.rule==='UI21')).toBe(false);
});
it('reserves compatibility utility definitions for the shared stylesheet',()=>{
  expect(evaluateUiSource('apps/web/src/lib/styles/main.scss','.hidden {display:none!important}').some(item=>item.rule==='UI15')).toBe(false);
  expect(evaluateUiSource('packages/ui-core/src/feature.scss','.ltr {direction:ltr}').some(item=>item.rule==='UI15')).toBe(true);
});
it('reports absent required static font assets',()=>{
  const root=mkdtempSync(join(tmpdir(),'u11-assets-'));
  try{
    const missing=checkTargetAssets(root);expect(missing.length).toBeGreaterThan(0);
    for(const finding of missing){const local=finding.path.split('apps/web/static/')[1];expect(local).toBeTruthy();const file=join(root,local!);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,'fixture');}
    expect(checkTargetAssets(root)).toEqual([]);
  }finally{rmSync(root,{recursive:true,force:true});}
});

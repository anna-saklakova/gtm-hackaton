import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function page(storage,fetch){
 const elements=Object.fromEntries(['#app','#progress','#reset','#error','#status'].map(id=>[id,{setAttribute(){},scrollIntoView(){},replaceChildren(){},append(){}}]));
 const context=vm.createContext({fetch,console,crypto:{randomUUID:()=> 'new-attempt'},setTimeout:fn=>fn(),sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k),clear:()=>storage.clear()},document:{querySelector:s=>elements[s],querySelectorAll:()=>[],createTextNode:s=>s,createElement:()=>({})}});
 vm.runInContext(source.replace(/init\(\);\s*$/,''),context);
 vm.runInContext('render=()=>{}',context);
 return context;
}
const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});

test('reload resumes the saved search ID, waits through pending, and saves the completed token',async()=>{
 const pending={action:'research',summary:'My cafe idea',requestId:'original-search'};
 const storage=new Map([['pending-request',JSON.stringify(pending)],['session-token','old-token']]);let polls=0;
 const context=page(storage,async(path,options)=>{
  const body=JSON.parse(options.body);
  if(path==='/api/session')return response({state:{stage:'confirm'},token:'restored-token'});
  assert.equal(body.requestId,pending.requestId);assert.equal(body.summary,pending.summary);
  assert.equal(JSON.parse(storage.get('pending-request')).requestId,pending.requestId);
  if(++polls===1)return response({pending:true},202);
  return response({state:{stage:'results'},token:'completed-token'});
 });
 await vm.runInContext('init()',context);
 assert.equal(polls,2);assert.equal(vm.runInContext('state.stage',context),'results');assert.equal(storage.get('session-token'),'completed-token');assert.equal(storage.has('pending-request'),false);assert.equal(vm.runInContext('busy',context),false);
});

test('network interruption retains the request for automatic recovery after reload',async()=>{
 const storage=new Map();const context=page(storage,async()=>{throw new Error('Failed to fetch');});
 await vm.runInContext("send({action:'research',summary:'Saved idea'})",context);
 assert.equal(JSON.parse(storage.get('pending-request')).requestId,'new-attempt');assert.equal(vm.runInContext('busy',context),false);
 const restored=page(storage,async path=>response({state:{stage:path==='/api/session'?'confirm':'results'}}));
 await vm.runInContext('init()',restored);assert.equal(vm.runInContext('state.stage',restored),'results');assert.equal(storage.has('pending-request'),false);
});

test('definitive failure stops automatic replay and explicit retry gets a new ID',async()=>{
 const storage=new Map();const ids=[];
 const context=page(storage,async(_path,options)=>{ids.push(JSON.parse(options.body).requestId);return ids.length===1?response({error:'Search did not finish'},400):response({state:{stage:'results'}});});
 await vm.runInContext("send({action:'research',requestId:'failed-id'})",context);
 assert.equal(storage.has('pending-request'),false);
 await vm.runInContext('send(lastRequest)',context);assert.deepEqual(ids,['failed-id','new-attempt']);
});

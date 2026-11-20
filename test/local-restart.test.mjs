import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {fresh} from '../flow.mjs';
test('local progress, per-tab identity, and retry survive a real server restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sidequest-restart-')),file=join(dir,'sessions.json'),id=randomUUID();let child;
 const state={...fresh(),stage:'directions',initialUnderstanding:'Saved initial analysis',discovery:[{question:'Detail?',answer:'My answer'}],directions:[{title:'Saved plan',firstStep:{done:'File exists'}}]};
 await writeFile(file,JSON.stringify([[id,{state,last:null,busy:true}]]));
 const start=async()=>{child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3012',LOCAL_SESSION_FILE:file,OPENAI_API_KEY:'test-placeholder'},stdio:['ignore','pipe','pipe']});await Promise.race([once(child.stdout,'data'),once(child,'exit').then(([code])=>{throw new Error('server exited '+code);})]);};
 const stop=async()=>{const ended=once(child,'exit');child.kill();await ended;child=null;};
 const post=async(path,p)=>{const r=await fetch('http://127.0.0.1:3012'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});const data=await r.json();assert.equal(r.status,200,data.error);return data;};
 try{await start();let d=await post('/api/session',{localSessionId:id});assert.equal(d.state.stage,'directions');assert.equal(d.localSessionId,id);
 const action={localSessionId:id,action:'choose',index:0,requestId:'restart-retry'};d=await post('/api/action',action);assert.equal(d.state.stage,'step');
 await stop();await start();d=await post('/api/session',{localSessionId:id});assert.equal(d.state.stage,'step');assert.equal(d.state.initialUnderstanding,state.initialUnderstanding);assert.deepEqual(d.state.discovery,state.discovery);
 d=await post('/api/action',action);assert.equal(d.state.stage,'step');
 const other=await post('/api/session',{});assert.notEqual(other.localSessionId,id);assert.equal(other.state.stage,'idea');
 d=await post('/api/reset',{localSessionId:id});assert.equal(d.localSessionId,id);assert.equal(d.state.stage,'idea');await stop();await start();d=await post('/api/session',{localSessionId:id});assert.equal(d.state.stage,'idea');
 }finally{if(child)await stop();await rm(dir,{recursive:true,force:true});}
});

import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
let child;const base='http://127.0.0.1:3009';
before(async()=>{child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'3009',OPENAI_API_KEY:''},stdio:['ignore','pipe','ignore']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error(`server exited ${code}`)));});});
after(()=>child?.kill());
test('private files are never served',async()=>{for(const file of ['/.env','/.git/config','/ai.mjs']){const r=await fetch(base+file);assert.notEqual(r.status,200);assert.doesNotMatch(await r.text(),/OPENAI_API_KEY|Bearer/);}});
test('cross-origin mutations rejected',async()=>{const r=await fetch(base+'/api/session',{method:'POST',headers:{Origin:'https://attacker.example'}});assert.equal(r.status,403);});
test('session cookie is httpOnly and sameSite, missing-key error is actionable',async()=>{const r=await fetch(base+'/api/session',{method:'POST'});const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly; SameSite=Strict/);const d=await r.json();assert.equal(d.state.stage,'idea');const fail=await fetch(base+'/api/action',{method:'POST',headers:{Cookie:cookie.split(';')[0],'Content-Type':'application/json'},body:JSON.stringify({action:'start',answer:'test',requestId:'test'})});assert.equal(fail.status,503);assert.match((await fail.json()).error,/restart/);});

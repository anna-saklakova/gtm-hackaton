import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../cloud.mjs';
import {newSession,seal,unseal} from '../session-token.mjs';
before(()=>{process.env.OPENAI_API_KEY='test-only-placeholder';process.env.SESSION_SECRET='test-only-encryption-secret';});
async function request(body,path='/api/session',headers={}){let result;const res={statusCode:200,setHeader(){},end(raw){result={status:this.statusCode,...JSON.parse(raw)};}};await handler({url:path,method:'POST',headers:{host:'demo.vercel.app',...headers},body},res);return result;}
test('encrypted session survives a new server handler without a database',async()=>{const first=await request({});assert.equal(first.state.stage,'idea');assert.ok(first.token);const recovered=unseal(first.token);assert.equal(recovered.state.stage,'idea');assert.ok(!first.token.includes('test-only'));const restored=await request({token:first.token});assert.equal(restored.state.stage,'idea');});
test('tampered and expired tokens cannot change state or bypass counters',async()=>{const s=newSession();s.state.attempts=29;const token=seal(s);assert.equal(unseal(token).state.attempts,29);const b=Buffer.from(token,'base64url');b[30]^=1;assert.throws(()=>unseal(b.toString('base64url')),/invalid/);s.expires=Date.now()-1;assert.throws(()=>unseal(seal(s)),/expired/);});
test('cloud route rewrite, state transition and retry use the same completed result',async()=>{const s=newSession();s.state.stage='directions';s.state.directions=[{title:'A',firstStep:{done:'saved'}},{title:'B'}];const body={token:seal(s),action:'choose',index:0,requestId:'choose-test'};const result=await request(body,'/api/index?route=action');assert.equal(result.state.stage,'step');const retry=await request(body,'/api/index?route=action');assert.equal(retry.token,result.token);const restored=await request({token:result.token});assert.equal(restored.state.chosen,0);});
test('failed actions retain answers and consume an attempt',async()=>{const s=newSession();s.state.idea='saved idea';const r=await request({token:seal(s),action:'choose',index:0,requestId:'bad-action'},'/api/action');assert.equal(r.status,400);const next=unseal(r.token);assert.equal(next.state.idea,'saved idea');assert.equal(next.state.attempts,1);assert.equal(next.state.stage,'idea');});
test('cloud rejects cross-origin requests',async()=>{const r=await request({},'/api/session',{origin:'https://elsewhere.example'});assert.equal(r.status,403);});
test('signed session search limit is enforced before calling AI',async()=>{const s=newSession();s.state.stage='confirm';s.state.searchAttempts=2;const r=await request({token:seal(s),action:'research',requestId:'limit-test'},'/api/action');assert.equal(r.status,429);assert.match(r.error,/Search limit/);});

test('reloaded search reconnects to the running ID and replays its result without another AI call',async()=>{
 const original=global.fetch;let release,started,calls=0;
 const entered=new Promise(resolve=>started=resolve),gate=new Promise(resolve=>release=resolve);
 global.fetch=async()=>{calls++;started();await gate;return {ok:true,json:async()=>({status:'completed',output:[{type:'web_search_call',action:{sources:[]}},{content:[{type:'output_text',text:JSON.stringify({solutions:[],note:'No verified finds'})}]}]})};};
 const s=newSession();s.state.stage='confirm';s.state.summary='Quiet cafe finder';
 const body={token:seal(s),action:'research',summary:s.state.summary,requestId:'reload-search'};
 let running;
 try{
  running=request(body,'/api/action');await entered;
  const pending=await request(body,'/api/action');assert.equal(pending.status,202);assert.equal(pending.pending,true);
  const other=await request({...body,requestId:'different-search'},'/api/action');assert.equal(other.status,409);
  release();const done=await running;assert.equal(done.status,200);assert.equal(done.state.stage,'results');
  const replay=await request(body,'/api/action');assert.equal(replay.token,done.token);assert.equal(replay.state.searchAttempts,1);assert.equal(calls,1);
 }finally{release();await running;global.fetch=original;}
});

test('reconnecting to a failed request replays the failure without another charged attempt',async()=>{
 const s=newSession();const body={token:seal(s),action:'choose',index:0,requestId:'failed-reconnect'};
 const failed=await request(body,'/api/action');const replay=await request(body,'/api/action');
 assert.equal(replay.status,400);assert.equal(replay.token,failed.token);assert.equal(unseal(replay.token).state.attempts,1);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeUrl,validateResearch,sourceUrls,callAI,interviewSchema} from '../ai.mjs';
import {fresh,transition} from '../flow.mjs';
test('only http(s) URLs without credentials',()=>{assert.equal(safeUrl('javascript:alert(1)'),null);assert.equal(safeUrl('https://user:pass@example.org'),null);assert.equal(safeUrl('https://example.org'),'https://example.org/');});
test('research drops invented cards and unsupported claims',()=>{
 const response={output:[{type:'web_search_call',action:{sources:[{url:'https://real.org/'}]}},{content:[{annotations:[{type:'url_citation',url:'https://real.org/help'}]}]}]};
 const real={name:'Real',url:'https://real.org',facts:[{claim:'Verified',source:'https://real.org/help'},{claim:'Invented',source:'https://fake.org/'}],limitations:[{claim:'Unsupported',source:'https://fake.org/'}]};
 const result=validateResearch({note:'',solutions:[real,{...real,name:'Fake',url:'https://fake.org/'}]},response);
 assert.equal(sourceUrls(response).size,2);assert.equal(result.solutions.length,1);assert.equal(result.solutions[0].facts.length,1);assert.equal(result.solutions[0].limitations.length,0);assert.match(result.note,/Partial/);
});
test('invalid state transitions do not run AI',async()=>{await assert.rejects(transition(fresh(),'choose',{index:0}),/step/);});
test('choosing yields the generated first step without another API call',async()=>{const s=fresh();s.stage='directions';s.directions=[{firstStep:{done:'file exists'}},{}];await transition(s,'choose',{index:0});assert.equal(s.stage,'step');assert.equal(s.chosen,0);});
test('network errors never expose raw headers or secrets',async()=>{const original=global.fetch;global.fetch=async()=>{throw new Error('sensitive internal details');};try{await assert.rejects(callAI({schema:interviewSchema,input:{},instructions:''}),e=>/Your answers are saved/.test(e.message)&&!e.message.includes('sensitive'));}finally{global.fetch=original;}});
test('incomplete output is retryable',async()=>{const original=global.fetch;global.fetch=async()=>({ok:true,json:async()=>({status:'incomplete'})});try{await assert.rejects(callAI({schema:interviewSchema,input:{},instructions:''}),/did not finish/);}finally{global.fetch=original;}});
test('missing search call cannot be presented as live research',async()=>{const original=global.fetch;global.fetch=async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:'{"solutions":[],"note":""}'}]}]})});try{await assert.rejects(callAI({schema:interviewSchema,input:{},instructions:'',search:true}),/Web search did not run/);}finally{global.fetch=original;}});

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

async function mockAI(data,run){const original=global.fetch;const inputs=[];global.fetch=async(_url,request)=>{inputs.push(JSON.parse(request.body));return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(data)}]}]})};};try{await run(inputs);}finally{global.fetch=original;}}
test('ticks alone generate the final product plan and pass selected ideas to AI',async()=>{
 const plan={title:'My project',buildPrompt:'Build a tiny project',nextSteps:['Build','Try','Improve'],firstStep:{action:'Create a file',result:'A file',done:'It opens'}};
 await mockAI({directions:[plan]},async(inputs)=>{const s=fresh();s.stage='results';s.research={solutions:[{name:'First',differences:'Useful extra'},{name:'Second'}]};await transition(s,'feedback',{selected:[0,0,9,'1'],answer:''});assert.equal(s.stage,'step');assert.equal(s.chosen,0);assert.deepEqual(s.selected,['First']);assert.deepEqual(s.directions,[plan]);const input=JSON.parse(inputs[0].input);assert.deepEqual(input.selected,['First']);assert.equal(input.research.solutions[0].differences,'Useful extra');assert.equal(input.feedback,'');});
});
test('research never displays more than four verified companies',()=>{const url='https://real.org/';const card={name:'Real',url,facts:[{claim:'Verified',source:url}],limitations:[]};const r=validateResearch({solutions:Array.from({length:7},(_,i)=>({...card,name:`Company ${i}`})),note:''},{output:[{type:'web_search_call',action:{sources:[{url}]}}]});assert.equal(r.solutions.length,4);assert.doesNotMatch(r.note,/Partial/);});

test('research receives explicit location including no geographic preference',async()=>{
 const original=global.fetch;try{for(const location of ['Berlin, Germany','Not important']){let body;global.fetch=async(_url,request)=>{body=JSON.parse(request.body);return {ok:true,json:async()=>({status:'completed',output:[{type:'web_search_call',action:{sources:[]}},{content:[{type:'output_text',text:JSON.stringify({note:'No verified finds',solutions:[]})}]}]})};};const s=fresh();s.stage='confirm';s.idea='A tool';s.location=location;await transition(s,'research',{summary:'A tool'});assert.equal(JSON.parse(body.input).location,location);assert.match(body.instructions,/Not important/);assert.match(body.instructions,/доступность/);assert.equal(s.stage,'results');}}finally{global.fetch=original;}
});

const questions=n=>Array.from({length:n},(_,i)=>({text:'Idea detail '+i+'?',options:['First scenario','Second scenario','Both scenarios']}));
test('Soft and Hard plan the complete questionnaire once, then accept all answers without AI',async()=>{
 for(const [mode,count] of [['soft',1],['soft',3],['hard',7],['hard',9]])await mockAI({summary:'A tiny idea',questions:questions(count)},async(inputs)=>{const s=fresh();await transition(s,'start',{answer:'My idea',mode});assert.equal(s.mode,mode);assert.equal(s.questions.length,count+1);assert.equal(inputs.length,1);assert.equal(JSON.parse(inputs[0].input).idea,'My idea');const location=s.questions.at(-1);assert.equal(location.kind,'location');assert.deepEqual(location.options,['Not important','Berlin','New York','Europe']);const answers=s.questions.map(q=>q.kind==='location'?'Berlin':'First scenario, Second scenario, my detail');await transition(s,'answer',{answers});assert.equal(inputs.length,1);assert.equal(s.stage,'confirm');assert.equal(s.location,'Berlin');assert.equal(s.discovery.length,count+1);assert.equal(s.discovery[0].answer,answers[0]);});
});
test('mode defaults to Soft and invalid questionnaire sizes cannot proceed',async()=>{
 await mockAI({summary:'Idea',questions:questions(1)},async()=>{const s=fresh();await transition(s,'start',{answer:'My idea'});assert.equal(s.mode,'soft');await assert.rejects(transition(s,'answer',{answers:['Only one']}),/each question/);assert.equal(s.stage,'discovery');assert.equal(s.discovery.length,0);});
 for(const [mode,count]of [['soft',0],['soft',4],['hard',6],['hard',10]])await mockAI({summary:'Idea',questions:questions(count)},async()=>{await assert.rejects(transition(fresh(),'start',{answer:'My idea',mode}),/questionnaire/);});
});

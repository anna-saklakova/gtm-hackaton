// Live end-to-end test. Uses the running local server and incurs API usage.
import {writeFile} from 'node:fs/promises';
const base=process.env.SMOKE_URL||'http://127.0.0.1:3000';let cookie='',token='';let state;
async function post(path,p){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({...p,...(token?{token}:{})})});cookie=r.headers.get('set-cookie')?.split(';')[0]||cookie;const d=await r.json();token=d.token||token;if(!r.ok)throw new Error(d.error);state=d.state;return d;}
async function act(action,p={}){const t=Date.now();await post('/api/action',{action,requestId:crypto.randomUUID(),...p});console.log(JSON.stringify({action,stage:state.stage,seconds:Math.round((Date.now()-t)/1000),question:state.question?.text,solutions:state.research?.solutions.length}));}
function english(value){if(/[А-Яа-яЁё]/.test(value||''))throw new Error('Expected English AI output');}
await post('/api/session',{});
await act('start',{answer:'Хочу сервис по быстрому поиску догситера, который совпадает со мной по ценностям. Для меня важно честно рассказывать о сложностях и соблюдать пунктуальность.'});
await act('answer',{answers:state.questions.map(q=>q.kind==='location'?'Berlin':q.options[0])});
if(state.stage!=='confirm')throw new Error('Missing confirmation');
english(state.summary);
await act('research',{summary:state.summary});
if(state.stage!=='results')throw new Error('Missing results');
english(state.research.note);for(const s of state.research.solutions){for(const k of ['task','similarity','differences'])english(s[k]);for(const f of [...s.facts,...s.limitations])english(f.claim);}
console.log(JSON.stringify({names:state.research.solutions.map(s=>({name:s.name,url:s.url,facts:s.facts.length})),note:state.research.note}));
await act('feedback',{selected:state.research.solutions[0]?.facts.length?['0:existing:0']:[],answer:'Мне не хватает честных коротких заметок о сложностях конкретной собаки и договорённостей о пунктуальности. Хочу сделать для себя, без публичного маркетплейса. Я новичок: знаю немного HTML и JavaScript, есть два вечера по часу, бюджет ноль, готов разбираться, но без сервера, платежей и интеграций.'});
if(state.stage!=='step'||state.directions.length!==1)throw new Error('Missing directions');
for(const d of state.directions){for(const k of ['title','audience','task','difference','preference','mvp','difficulty','assumptions'])english(d[k]);for(const v of Object.values(d.firstStep))english(v);}
console.log(JSON.stringify({directions:state.directions.map(d=>({title:d.title,mvp:d.mvp,preference:d.preference}))}));
if(!state.directions[0].buildPrompt||!state.directions[0].nextSteps.length)throw new Error('Missing prompt or next steps');
if(state.stage!=='step'||!state.directions[0].firstStep.done)throw new Error('Missing first step');
await writeFile('test-results/live-session.json',JSON.stringify(state,null,2));
console.log('PASS: full live journey; saved test-results/live-session.json');

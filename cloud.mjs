import {newSession,seal,unseal} from './session-token.mjs';
import {transition} from './flow.mjs';
const requests=new Map(),busy=new Map(),traffic=new Map();
function reply(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(data));}
async function readBody(req){if(req.body&&typeof req.body==='object')return req.body;let raw='';for await(const c of req){raw+=c;if(raw.length>220000)throw new Error('This request is too large.');}return JSON.parse(raw||'{}');}
export default async function handler(req,res){
 const url=new URL(req.url||'/',`https://${req.headers.host||'localhost'}`);const route=url.searchParams.get('route');const path=route?'/api/'+route:url.pathname;
 if(req.method==='GET'&&path==='/api/health')return reply(res,200,{ok:true,keyConfigured:!!process.env.OPENAI_API_KEY});
 if(req.method!=='POST')return reply(res,405,{error:'Use POST.'});
 const host=req.headers.host;
 if(req.headers.origin){try{const origin=new URL(req.headers.origin);if(origin.host!==host)return reply(res,403,{error:'This request origin is not allowed.'});}catch{return reply(res,403,{error:'This request origin is not allowed.'});}}
 let session;
 try{
  const p=await readBody(req);
  if(!['/api/session','/api/action','/api/reset'].includes(path))return reply(res,404,{error:'Page not found.'});
  if(!process.env.OPENAI_API_KEY){if(path!=='/api/action')return reply(res,200,{state:newSession().state});return reply(res,503,{error:'Add OPENAI_API_KEY in Vercel Project Settings → Environment Variables, then redeploy.'});}
  session=path==='/api/reset'?newSession():p.token?unseal(p.token):newSession();
  const result=()=>({state:session.state,token:seal(session)});
  if(path!=='/api/action')return reply(res,200,result());
  if(!p.token)return reply(res,410,{error:'Session expired. Start a new idea.'});
  if(typeof p.requestId!=='string'||!p.requestId||p.requestId.length>100)return reply(res,400,{error:'Invalid request.'});
  const id=session.id+':'+p.requestId;
  for(const [k,v]of requests)if(v.expires<Date.now())requests.delete(k);
  if(requests.has(id)){const cached=requests.get(id);return reply(res,cached.status||200,cached.data);}
  if(busy.get(session.id)===p.requestId)return reply(res,202,{pending:true});
  if(busy.has(session.id))return reply(res,409,{error:'Your previous request is still running. Wait and try again.'});
  // Best-effort instance-local burst protection, in addition to signed session limits.
  const ip=String(req.headers['x-forwarded-for']||'local').split(',')[0];const now=Date.now();for(const [k,v]of traffic)if(v.until<now)traffic.delete(k);
  const rate=traffic.get(ip)||{count:0,until:now+60000};rate.count++;traffic.set(ip,rate);if(rate.count>20)return reply(res,429,{error:'Too many requests. Try again in a minute.'});
  if(session.state.attempts>=30)return reply(res,429,{error:'Session limit reached. Start a new idea.'});
  if(p.action==='research'&&session.state.searchAttempts>=2)return reply(res,429,{error:'Search limit reached. Start a new idea.'});
  busy.set(session.id,p.requestId);session.state.attempts++;if(p.action==='research')session.state.searchAttempts++;
  try{const next=structuredClone(session.state);await transition(next,p.action,p);session.state=next;const data=result();if(requests.size>=500)requests.delete(requests.keys().next().value);requests.set(id,{expires:Date.now()+10*60000,data});return reply(res,200,data);}catch(e){const data={error:e.message||'Something went wrong. Try again.',token:seal(session)};if(requests.size>=500)requests.delete(requests.keys().next().value);requests.set(id,{expires:Date.now()+10*60000,status:400,data});return reply(res,400,data);}finally{busy.delete(session.id);}
 }catch(e){return reply(res,400,{error:e instanceof SyntaxError?'Invalid request.':e.message||'Something went wrong. Try again.',...(session?{token:seal(session)}:{})});}
}

import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fresh,transition} from './flow.mjs';
const sessions=new Map();const port=Number(process.env.PORT||3000);const host='127.0.0.1';
const assets={'/':['public/index.html','text/html; charset=utf-8'],'/app.js':['public/app.js','text/javascript; charset=utf-8'],'/style.css':['public/style.css','text/css; charset=utf-8']};
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)throw new Error('This request is too large.');}return JSON.parse(raw||'{}');}
export const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' https://www.google.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 if(req.headers.host!==`${host}:${port}`&&req.headers.host!==`localhost:${port}`)return reply(res,403,{error:'Invalid address.'});
 if(req.headers.origin&&!([`http://localhost:${port}`,`http://${host}:${port}`].includes(req.headers.origin)))return reply(res,403,{error:'This request origin is not allowed.'});
 try{
 const url=new URL(req.url,`http://${host}:${port}`);
 if(req.method==='GET'&&assets[url.pathname]){const [file,type]=assets[url.pathname];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});return res.end(await readFile(new URL(file,import.meta.url)));}
 if(req.method==='GET'&&url.pathname==='/api/health')return reply(res,200,{ok:true,keyConfigured:!!process.env.OPENAI_API_KEY});
 let sid=req.headers.cookie?.match(/(?:^|; )sid=([a-f0-9-]+)/)?.[1];let session=sessions.get(sid);
 if(session&&session.expires<Date.now()&&!session.busy){sessions.delete(sid);session=null;}
 if(!session){if(req.method!=='POST'||!['/api/session','/api/reset'].includes(url.pathname))return reply(res,410,{error:'Session expired. Start a new idea; your draft is still in this tab.'});if(sessions.size>=100)return reply(res,429,{error:'Too many sessions. Try again later.'});sid=randomUUID();session={state:fresh(),busy:false,expires:Date.now()+6*3600000,last:null};sessions.set(sid,session);res.setHeader('Set-Cookie',`sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=21600`);}
 if(req.method==='POST'&&url.pathname==='/api/session')return reply(res,200,{state:session.state});
 if(req.method==='POST'&&url.pathname==='/api/action'){
  if(!process.env.OPENAI_API_KEY)return reply(res,503,{error:'Add OPENAI_API_KEY to the server .env and restart the server.'});
  const p=await body(req);if(!p.requestId||typeof p.requestId!=='string'||p.requestId.length>100)return reply(res,400,{error:'Invalid request.'});
  if(session.last===p.requestId)return reply(res,200,{state:session.state});
  if(session.busy)return reply(res,409,{error:'Your previous request is still running. Wait a moment and try again.'});
  if(session.state.attempts>=30)return reply(res,429,{error:'Session limit reached (30 requests). Start a new idea.'});
  if(p.action==='research'&&session.state.searchAttempts>=2)return reply(res,429,{error:'Search limit reached (2 attempts). Start a new idea.'});
  session.busy=true;session.state.attempts++;if(p.action==='research')session.state.searchAttempts++;
  try{const next=structuredClone(session.state);await transition(next,p.action,p);session.state=next;session.last=p.requestId;return reply(res,200,{state:next});}finally{session.busy=false;}
 }
 if(req.method==='POST'&&url.pathname==='/api/reset'){if(session.busy)return reply(res,409,{error:'Wait for the current request to finish.'});session.state=fresh();session.last=null;return reply(res,200,{state:session.state});}
 reply(res,404,{error:'Page not found.'});
 }catch(e){reply(res,400,{error:e instanceof SyntaxError?'Invalid request.':e.message||'Could not complete the request. Try again.'});}
});
setInterval(()=>{for(const [id,s]of sessions)if(s.expires<Date.now()&&!s.busy)sessions.delete(id);},60000).unref();
server.listen(port,host,()=>console.log(`Open http://localhost:${port}`));

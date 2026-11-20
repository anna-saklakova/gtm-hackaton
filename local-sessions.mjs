import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
export async function openLocalSessions(file){
 let entries=[];try{entries=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const sessions=new Map(entries.map(([id,s])=>[id,{...s,busy:false}]));let pending=Promise.resolve();
 function save(){const data=JSON.stringify([...sessions].map(([id,s])=>[id,{state:s.state,last:s.last,busy:false}]));const write=pending.catch(()=>{}).then(async()=>{await mkdir(dirname(file),{recursive:true});await writeFile(file+'.tmp',data,{mode:0o600});await rename(file+'.tmp',file);});pending=write;return write;}
 return {sessions,save};
}

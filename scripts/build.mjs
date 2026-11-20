import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const name of ['index.html','app.js','style.css'])await copyFile(`public/${name}`,`dist/${name}`);
console.log('Built static frontend. Server secrets are not copied.');

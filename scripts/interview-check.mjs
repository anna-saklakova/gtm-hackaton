import assert from 'node:assert/strict';
import {fresh,transition} from '../flow.mjs';
let s=fresh();await transition(s,'start',{answer:'Хочу сервис по быстрому поиску догситера, который совпадает со мной по ценностям'});
console.log(JSON.stringify({stage:s.stage,question:s.question?.text,summary:s.summary}));assert.equal(s.stage,'discovery','A vague idea should trigger a question');
await transition(s,'answer',{answer:'Берлин, присмотр на несколько часов. Важны честно рассказывать о сложностях и пунктуальность.'});
console.log(JSON.stringify({stage:s.stage,question:s.question?.text}));
for(let i=0;s.stage==='discovery'&&i<3;i++){await transition(s,'answer',{answer:'Для себя: сравнить кандидатов до встречи. Других требований нет, не знаю.'});console.log(JSON.stringify({stage:s.stage,question:s.question?.text}));}
assert.equal(s.stage,'confirm');
s.stage='results';s.research={solutions:[],note:'Test: no research performed'};
await transition(s,'feedback',{selected:[],answer:'Ничего не зацепило. Я хочу учиться и сделать локальную заметку для себя. Знаю немного HTML/JS, новичок, два вечера по часу, бюджет ноль. Готов разбираться с формами, без API, серверов, регистрации и платежей.'});
console.log(JSON.stringify({stage:s.stage,question:s.question?.text,directions:s.directions.map(d=>({title:d.title,difficulty:d.difficulty}))}));assert.equal(s.stage,'directions','Do not re-ask known personal constraints');
console.log('PASS: adaptive interviews');

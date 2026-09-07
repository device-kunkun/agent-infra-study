import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const script=await readFile(path.join(root,'sw.js'),'utf8');
const store=new Map(),listeners={};let connected=true,corrupt='',fetchCount=0,claimed=false;
const origin='https://offline-study.test/agent-infra-study/';
const caches={
  async open(name){if(!store.has(name))store.set(name,new Map());const items=store.get(name);return{
    async match(key){return items.get(typeof key==='string'?key:key.url)?.clone();},
    async put(key,value){items.set(typeof key==='string'?key:key.url,value.clone());}
  };},async keys(){return [...store.keys()];},async delete(key){return store.delete(key);}
};
const context=vm.createContext({Request,Response,URL,Uint8Array,crypto:webcrypto,caches,
  fetch:async req=>{fetchCount++;if(!connected)throw new Error('Offline');const name=new URL(req.url).pathname.slice(new URL(origin).pathname.length);if(name===corrupt)return new Response('<html>Sign in</html>');return new Response(await readFile(path.join(root,name)));},
  self:{registration:{scope:origin},location:{origin:new URL(origin).origin},clients:{claim:async()=>{claimed=true;}},addEventListener:(name,handler)=>{listeners[name]=handler;}}
});
vm.runInContext(script,context);
async function dispatch(name,event={}){let pending;listeners[name]({...event,waitUntil:p=>{pending=p;}});if(pending)await pending;}
async function message(type){let result;await dispatch('message',{data:{type},ports:[{postMessage:value=>{result=value;}}]});return result;}
await dispatch('install');await dispatch('activate');assert.equal(claimed,true);assert.equal((await message('CHECK_OFFLINE')).ready,true);
const cacheName=(await caches.keys())[0];assert.equal(store.get(cacheName).size,8);
connected=false;const before=fetchCount;
for(const name of ['index.html','content.js','app.js','app.css','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png']){
  let response;const req={url:origin+name,method:'GET',mode:name==='index.html'?'navigate':'cors'};
  listeners.fetch({request:req,respondWith:p=>{response=p;}});assert.ok(response);assert.equal((await response).status,200);
}
assert.equal(fetchCount,before,'Offline assets must never need the network');
assert.equal((await message('CHECK_OFFLINE')).ready,true);
store.get(cacheName).delete(origin+'content.js');assert.equal((await message('CHECK_OFFLINE')).ready,false);
assert.equal((await message('REPAIR_OFFLINE')).ready,false,'Missing content must never show ready offline');
connected=true;corrupt='content.js';assert.equal((await message('REPAIR_OFFLINE')).ready,false,'Login HTML or corrupt content is rejected');
corrupt='';assert.equal((await message('REPAIR_OFFLINE')).ready,true);assert.equal((await message('CHECK_OFFLINE')).ready,true);
store.set('agent-infra-study-other-scope',new Map());store.set('unrelated-app-cache',new Map());await dispatch('activate');assert.ok(store.has('unrelated-app-cache'),'Do not delete other apps caches');assert.ok(store.has('agent-infra-study-other-scope'),'Do not delete another deployment cache on the same origin');
const content={window:{}};vm.runInNewContext(await readFile(path.join(root,'content.js'),'utf8'),content);
const d=content.window.HANDBOOK;assert.equal(d.questions.length,240);assert.equal(d.chapters.reduce((n,c)=>n+c.questions.length,0),240);
assert.ok(d.questions.every(q=>q.html.length>240));assert.equal(new Set(d.questions.map(q=>q.id)).size,240);
console.log('PASS: 240 complete questions; all 8 resources served offline without network; incomplete/corrupt/login content rejected; cache repair; unrelated cache preserved.');

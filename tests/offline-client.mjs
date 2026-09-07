import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MessageChannel} from 'node:worker_threads';
import vm from 'node:vm';

const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
const contentSource=await readFile(new URL('../web/content.js',import.meta.url),'utf8');
const hook='globalThis.cacheTest={checkOffline, getStatus:()=>({ready:offlineReady,message:offlineMessage})};';
assert.ok(source.includes('theme();render();prepareOffline();'));
const testSource=source.replace('theme();render();prepareOffline();',hook);

async function scenario({ready=true,online=true,waiting=false,repair={ready:true},repairThrows=false,updateFails=false,manual=true}={}){
  const calls=[],elements=new Map();
  const records={schema:1,read:{Q005:true},bookmarks:{Q005:true},scores:{Q005:'3'},last:'Q005',positions:{Q005:123},theme:'dark',font:20};
  let stored=JSON.stringify(records);
  const initial=stored;
  function element(id){if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,addEventListener(){},classList:{toggle(){}},style:{setProperty(){}}});return elements.get(id);}
  function worker(name,responses){return{postMessage(request,ports){calls.push(name+':'+request.type);if(repairThrows&&request.type==='REPAIR_OFFLINE')throw new Error('Worker channel unavailable');ports[0].postMessage(responses[request.type]);ports[0].close();}};}
  const current=worker('current',{CHECK_OFFLINE:{ready},REPAIR_OFFLINE:repair});
  const next=worker('next',{CHECK_OFFLINE:{ready:true}});
  const registration={installing:null,waiting:waiting?next:null,update:async()=>{calls.push('update');if(updateFails)throw new Error('Update network unavailable');}};
  const document={getElementById:element,addEventListener(){},documentElement:{dataset:{},style:{setProperty(){}}}};
  const context=vm.createContext({document,window:{addEventListener(){},isSecureContext:true},navigator:{onLine:online,serviceWorker:{controller:current,addEventListener(){},getRegistration:async()=>registration},storage:{persist:async()=>true}},localStorage:{getItem:()=>stored,setItem:(_,text)=>{stored=text;}},MessageChannel,setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;},clearTimeout});
  vm.runInContext(contentSource,context);
  vm.runInContext(testSource,context);
  await context.cacheTest.checkOffline(manual);
  assert.equal(stored,initial,'Cache operations must not clear or rewrite study records');
  return{calls,status:context.cacheTest.getStatus()};
}

const manual=await scenario();
assert.ok(manual.calls.includes('current:REPAIR_OFFLINE'),'Manual download must fetch even with a healthy cache');
assert.ok(manual.calls.indexOf('update')<manual.calls.indexOf('current:REPAIR_OFFLINE'));
assert.equal(manual.status.ready,true);

const upgrade=await scenario({ready:false,waiting:true,repair:{ready:false,error:'Old hash mismatch'}});
assert.ok(upgrade.calls.includes('next:CHECK_OFFLINE'));
assert.ok(!upgrade.calls.includes('current:REPAIR_OFFLINE'),'Do not repair old hashes after a new bundle is ready');
assert.equal(upgrade.status.ready,false,'A waiting worker cannot certify the incomplete current cache');
assert.match(upgrade.status.message,/新版离线内容已下载.*关闭/);

const failed=await scenario({repair:{ready:false,error:'content.js 内容校验失败'},updateFails:true});
assert.equal(failed.status.ready,true,'Keep the healthy old bundle usable when a new download fails');
assert.match(failed.status.message,/重新下载失败.*content.js/);

const disconnected=await scenario({repairThrows:true});
assert.equal(disconnected.status.ready,true,'A rejected worker message must retain the healthy cache status');
assert.match(disconnected.status.message,/Worker channel unavailable/);

const offline=await scenario({online:false,manual:false});
assert.deepEqual(offline.calls,['current:CHECK_OFFLINE']);
assert.equal(offline.status.ready,true);
console.log('PASS: manual redownload; new-worker upgrade before old-cache repair; healthy cache retained on update failure; offline launch; learning records unchanged.');

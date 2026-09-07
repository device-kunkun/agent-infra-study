'use strict';
const VERSION='__BUILD_VERSION__';
const HASHES=__ASSET_HASHES__;
const PREFIX='agent-infra-study-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE=PREFIX+VERSION;
const ASSETS=Object.keys(HASHES);
const assetURL=name=>new URL(name,self.registration.scope).href;
async function digest(response){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await response.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function complete(){
  const cache=await caches.open(CACHE);
  for(const name of ASSETS){const response=await cache.match(assetURL(name));if(!response||await digest(response)!==HASHES[name])return false;}
  return true;
}
async function fillCache(){
  const validated=[];
  for(const name of ASSETS){
    const response=await fetch(new Request(assetURL(name),{cache:'reload',credentials:'same-origin',redirect:'error'}));
    if(!response.ok||await digest(response.clone())!==HASHES[name])throw new Error('Offline asset validation failed: '+name);
    validated.push([name,response]);
  }
  const cache=await caches.open(CACHE);
  for(const [name,response] of validated)await cache.put(assetURL(name),response);
  if(!await complete())throw new Error('Incomplete offline bundle');
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    // Reject sign-in redirects, partial downloads, and mismatched version assets.
    // This cache is activated only when the entire bundle has verified successfully.
    await fillCache();
    // Do not skipWaiting: open readers finish on the previous complete version.
    // A newly installed worker activates automatically when there is no old worker.
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    if(!await complete())throw new Error('Offline bundle incomplete');
    for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  const name=decodeURIComponent(url.pathname.slice(new URL(self.registration.scope).pathname.length));
  if(req.mode==='navigate' && (name===''||name==='index.html')){
    event.respondWith((async()=>{const hit=await(await caches.open(CACHE)).match(assetURL('index.html'));return hit||fetch(req);})());return;
  }
  if(ASSETS.includes(name))event.respondWith((async()=>{const hit=await(await caches.open(CACHE)).match(assetURL(name));return hit||fetch(req);})());
  // External sources and authentication endpoints retain normal network behavior.
});
self.addEventListener('message',event=>{
  if(event.data?.type==='CHECK_OFFLINE')event.waitUntil((async()=>{const ready=await complete();event.ports[0]?.postMessage({ready,version:VERSION,assets:ASSETS.length});})());
  if(event.data?.type==='REPAIR_OFFLINE')event.waitUntil((async()=>{try{await fillCache();event.ports[0]?.postMessage({ready:true,version:VERSION,assets:ASSETS.length});}catch(_){event.ports[0]?.postMessage({ready:false});}})());
});

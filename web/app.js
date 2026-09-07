(() => {
  'use strict';
  const data = window.HANDBOOK;
  const app = document.getElementById('app');
  if (!data || data.questions.length !== 240) {
    app.innerHTML = '<h1>内容未能完整打开</h1><p>请保持联网并重新打开应用，完成首次下载。</p>';
    return;
  }
  const KEY = 'agent-infra-offline-v1';
  const qmap = new Map(data.questions.map(q => [q.id, q]));
  const cmap = new Map(data.chapters.map(c => [c.id, c]));
  const initial = () => ({schema:1, read:{}, bookmarks:{}, scores:{}, last:'Q001', positions:{}, theme:'auto', font:18});
  let state = initial(), storageOK = true, offlineReady = false, offlineMessage = '正在准备离线内容', activeQ = null;
  let filters = {query:'', chapter:'', level:'', status:''};
  let toastTimer, scrollTimer, swRegistration, offlineCheck;
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function validState(input) {
    if (!input || input.schema !== 1) throw new Error('备份格式不兼容');
    const next = initial();
    for (const id of qmap.keys()) {
      if (input.read?.[id] === true) next.read[id] = true;
      if (input.bookmarks?.[id] === true) next.bookmarks[id] = true;
      if (['0','1','2','3','4'].includes(String(input.scores?.[id]))) next.scores[id] = String(input.scores[id]);
      if (Number.isFinite(input.positions?.[id])) next.positions[id] = Math.max(0, Math.min(100000, input.positions[id]));
    }
    if (qmap.has(input.last)) next.last = input.last;
    if (['auto','light','dark'].includes(input.theme)) next.theme = input.theme;
    if ([16,18,20,22].includes(input.font)) next.font = input.font;
    return next;
  }
  try { const raw = localStorage.getItem(KEY); if (raw) state = validState(JSON.parse(raw)); }
  catch (_) { storageOK = false; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); storageOK = true; }
    catch (_) { storageOK = false; notify('当前无法保存进度，请到设置导出备份'); }
  }
  function theme() {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.style.setProperty('--font', state.font + 'px');
  }
  function notify(text) {
    const box = document.getElementById('toast'); box.textContent = text; box.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => {box.hidden = true;}, 3200);
  }
  function qrow(q) {
    const status = state.read[q.id] ? '已读' : '未读';
    const score = state.scores[q.id] == null ? '' : ' · 自评 ' + state.scores[q.id] + ' 分';
    return `<a class="row" href="#q/${q.id}"><span class="row-main"><strong>${escape(q.title)}</strong><small>${q.id} · ${q.level} · ${status}${score}${state.bookmarks[q.id]?' · 已收藏':''}</small></span><span class="chevron" aria-hidden="true">›</span></a>`;
  }
  function chapterRow(c) {
    const n = c.questions.filter(id => state.read[id]).length;
    return `<a class="row" href="#chapter/${c.id}"><span class="row-main"><strong>${escape(c.title)}</strong><small>${c.questions.length ? `${n} / ${c.questions.length} 题已读` : '全文随 App 离线保存'}</small></span><span class="chevron" aria-hidden="true">›</span></a>`;
  }
  function home() {
    const last = qmap.get(state.last), read = Object.keys(state.read).length;
    const mastered = Object.values(state.scores).filter(v => Number(v) >= 3).length;
    const started = read > 0 || state.last !== 'Q001' || (state.positions.Q001 || 0) > 50;
    app.innerHTML = `<p class="eyebrow">240 QUESTIONS · OFFLINE STUDY</p><h1>把知识讲清楚。</h1><p class="muted">从基础概念，到 Agent 与 AI Infra 的系统设计。</p>
      ${!storageOK?'<p class="notice storage-warning">当前无法读取或保存学习记录，请使用设置中的备份功能。</p>':''}
      <section class="panel resume"><span class="meta">${started?'上次读到':'从这里开始'} · ${last.id} / 240</span><h2>${escape(last.title)}</h2><a class="primary-link" href="#q/${last.id}">${started?'继续学习':'阅读第一题'}<span aria-hidden="true">→</span></a></section>
      <div class="stats"><div><strong>${read}<span> / 240</span></strong><span>已读题目</span></div><div><strong>${mastered}</strong><span>自评 3—4 分</span></div><div><strong>${Object.keys(state.bookmarks).length}</strong><span>收藏题目</span></div></div><progress value="${read}" max="240" aria-label="已读进度"></progress>
      <div class="section-head"><h2>按需要复习</h2></div><div class="quick-links"><a href="#library/weak">薄弱项</a><a href="#library/unread">未读题目</a><a href="#bookmarks">我的书签</a></div>
      <div class="section-head"><h2>24 个核心模块</h2><a href="#library">全部目录</a></div><div class="rows">${data.chapters.filter(c=>c.questions.length).slice(0,4).map(chapterRow).join('')}</div>
      <div class="section-head"><h2>案例与实作</h2></div><div class="rows">${data.chapters.filter(c=>!c.questions.length && /案例|实作|速查/.test(c.title)).map(chapterRow).join('')}</div>`;
  }
  function filteredQuestions() {
    const terms = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return data.questions.filter(q => (!filters.chapter || q.chapterId === filters.chapter) && (!filters.level || q.level === filters.level)
      && (!filters.status || (filters.status === 'unread' && !state.read[q.id]) || (filters.status === 'weak' && state.scores[q.id] != null && Number(state.scores[q.id]) <= 1))
      && terms.every(t => `${q.id} ${q.title} ${q.text}`.toLocaleLowerCase().includes(t)));
  }
  function results() {
    const list = filteredQuestions(), box = document.getElementById('results');
    if (!box) return;
    document.getElementById('filter-count').textContent = `${list.length} / 240 题 · 搜索包括完整答案`;
    box.innerHTML = list.length ? list.map(qrow).join('') : '<p class="empty">没有符合条件的题目。试试其他关键词，或清除筛选。</p>';
    document.getElementById('all-chapters').hidden = Boolean(filters.query || filters.chapter || filters.level || filters.status);
  }
  function library(routeFilter) {
    if (['weak','unread'].includes(routeFilter)) filters.status = routeFilter;
    app.innerHTML = `<h1>目录与搜索</h1><input id="search" class="search" type="search" placeholder="题号、概念或答案关键词" aria-label="搜索完整题库" value="${escape(filters.query)}">
      <div class="filters"><select id="chapter-filter" aria-label="按模块筛选"><option value="">全部模块</option>${data.chapters.filter(c=>c.questions.length).map(c=>`<option value="${c.id}">${escape(c.title)}</option>`).join('')}</select><select id="level-filter" aria-label="按难度筛选"><option value="">全部难度</option>${['L1','L2','L3','L4','L5'].map(l=>`<option>${l}</option>`).join('')}</select><select id="status-filter" aria-label="按学习状态筛选"><option value="">全部状态</option><option value="unread">未读题目</option><option value="weak">薄弱项：0—1 分</option></select><button id="clear-filters">清除筛选</button></div>
      <section id="all-chapters"><div class="section-head"><h2>学习模块</h2></div><div class="rows">${data.chapters.filter(c=>c.questions.length).map(chapterRow).join('')}</div><div class="section-head"><h2>案例、实作与参考</h2></div><div class="rows">${data.chapters.filter(c=>!c.questions.length).map(chapterRow).join('')}</div></section>
      <div class="section-head"><h2>题库</h2></div><p id="filter-count" class="filter-count" role="status"></p><div id="results" class="rows"></div>`;
    document.getElementById('chapter-filter').value = filters.chapter;
    document.getElementById('level-filter').value = filters.level;
    document.getElementById('status-filter').value = filters.status;
    document.getElementById('search').addEventListener('input', e => {filters.query = e.target.value; results();});
    [['chapter-filter','chapter'],['level-filter','level'],['status-filter','status']].forEach(([id,key]) => document.getElementById(id).addEventListener('change',e => {filters[key] = e.target.value; results();}));
    document.getElementById('clear-filters').addEventListener('click',()=>{filters={query:'',chapter:'',level:'',status:''}; library();});
    results();
  }
  function question(id) {
    const q = qmap.get(id); if (!q) return home();
    activeQ = q.id; state.last = q.id; save();
    const i = data.questions.indexOf(q);
    app.innerHTML = `<a class="backlink" href="#chapter/${q.chapterId}">‹ ${escape(q.chapter)}</a><article class="question-page">
      <div class="question-top"><p class="meta">${q.id} · ${q.level} · 完整解答</p><button id="bookmark" class="bookmark" aria-pressed="${Boolean(state.bookmarks[id])}">${state.bookmarks[id]?'★ 已收藏':'☆ 收藏'}</button></div>
      <h1 class="q-title">${escape(q.title)}</h1><div class="answer">${q.html}</div>
      <section class="rating"><label for="score">这道题，你能讲到哪一步？</label><select id="score"><option value="">尚未自评</option><option value="0">0 · 还不知道</option><option value="1">1 · 认得概念</option><option value="2">2 · 能讲清机制</option><option value="3">3 · 能实现或计算</option><option value="4">4 · 能诊断与取舍</option></select><button id="read-toggle" class="read-toggle" aria-pressed="${Boolean(state.read[id])}">${state.read[id]?'✓ 已读完 · 点击撤销':'标记为已读完'}</button></section>
      <div class="pager"><a ${i ? `href="#q/${data.questions[i-1].id}"` : 'class="disabled" aria-disabled="true"'}>← 上一题</a><a ${i < 239 ? `href="#q/${data.questions[i+1].id}"` : 'href="#home"'}>${i < 239 ? '下一题 →' : '回到学习首页'}</a></div><p class="q-position">${i+1} / 240 · 答案始终展开</p></article>`;
    document.getElementById('score').value = state.scores[id] ?? '';
    document.getElementById('score').addEventListener('change',e=>{if(e.target.value==='')delete state.scores[id];else state.scores[id]=e.target.value;save();notify('自评分已保存');});
    document.getElementById('bookmark').addEventListener('click',e=>{state.bookmarks[id] ? delete state.bookmarks[id] : state.bookmarks[id]=true;save();e.currentTarget.setAttribute('aria-pressed',Boolean(state.bookmarks[id]));e.currentTarget.textContent=state.bookmarks[id]?'★ 已收藏':'☆ 收藏';});
    document.getElementById('read-toggle').addEventListener('click',e=>{state.read[id] ? delete state.read[id] : state.read[id]=true;save();e.currentTarget.setAttribute('aria-pressed',Boolean(state.read[id]));e.currentTarget.textContent=state.read[id]?'✓ 已读完 · 点击撤销':'标记为已读完';});
    // Keep tables scrollable inside the reading column.
    app.querySelectorAll('.answer table').forEach(t=>{if(!t.parentElement.classList.contains('table-wrap')){const w=document.createElement('div');w.className='table-wrap';t.before(w);w.append(t);}});
  }
  function chapter(id) {
    const c = cmap.get(id); if (!c) return home();
    app.innerHTML = `<a class="backlink" href="#library">‹ 全部目录</a><div class="prose">${c.html}</div>${c.questions.length?`<div class="section-head"><h2>本章 10 题</h2></div><div class="rows">${c.questions.map(id=>qrow(qmap.get(id))).join('')}</div>`:''}`;
  }
  function bookmarks() {
    const list = data.questions.filter(q=>state.bookmarks[q.id]);
    app.innerHTML = `<h1>我的书签</h1><p class="muted">${list.length} 道收藏题目</p><div class="rows">${list.length?list.map(qrow).join(''):'<div class="panel empty">在题目右上角点“收藏”，方便回来反复阅读。<p><a href="#library">浏览题库</a></p></div>'}</div>`;
  }
  function settings() {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    app.innerHTML = `<h1>阅读设置</h1><section class="panel"><h2>适合你的阅读方式</h2><div class="settings-row"><label for="theme">显示模式</label><select id="theme"><option value="auto">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></div><div class="settings-row"><label for="font">正文字号</label><select id="font"><option value="16">较小</option><option value="18">标准</option><option value="20">较大</option><option value="22">大字</option></select></div></section>
      <section class="panel"><h2>离线学习</h2><p id="offline-detail" class="status-detail">${escape(offlineMessage)}</p><button id="check-offline">检查离线内容</button><p class="meta">240 道完整解答、全部案例与实作都保存在本机。外部参考链接需要联网。系统清理网站数据后，需要重新下载。</p></section>
      <section class="panel"><h2>${standalone?'已从主屏幕打开':'安装到 iPhone 主屏幕'}</h2><ol class="install-steps"><li>在 iPhone 的 Safari 打开部署后的 HTTPS 地址。</li><li>打开分享菜单，选择“添加到主屏幕”；如有“作为网页 App 打开”，保持开启。</li><li>从主屏幕的新图标打开，等右上角显示“离线已就绪”。</li><li>关闭 Wi-Fi 和蜂窝网络，关闭应用再重新打开，即可验证离线学习。</li></ol><p class="meta">请以主屏幕 App 内的就绪状态为准；Safari 与主屏幕 App 的本地记录可能独立。</p></section>
      <section class="panel"><h2>备份学习记录</h2><p class="meta">进度、书签和自评分只保存在当前设备，不会自动同步。换设备或清理数据前，请导出备份。</p><div class="settings-actions"><button id="export">导出进度与书签</button><button id="import">导入备份并合并</button></div><p class="meta">也可导入电脑版手册导出的自评分 JSON。</p></section>
      <p class="meta">内容版本 ${escape(data.version)} · 240 道题<br>所有答案默认展开 · 无广告、无统计追踪</p>`;
    document.getElementById('theme').value=state.theme;
    document.getElementById('font').value=String(state.font);
    document.getElementById('theme').addEventListener('change',e=>{state.theme=e.target.value;theme();save();});
    document.getElementById('font').addEventListener('change',e=>{state.font=Number(e.target.value);theme();save();});
    document.getElementById('check-offline').addEventListener('click',()=>prepareOffline(true));
    document.getElementById('export').addEventListener('click',exportState);
    document.getElementById('import').addEventListener('click',()=>document.getElementById('import-file').click());
  }
  async function exportState() {
    const payload={app:'Agent Infra Offline',version:1,exportedAt:new Date().toISOString(),state};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const name='系统研习-学习记录-'+new Date().toISOString().slice(0,10)+'.json';
    const file=new File([blob],name,{type:'application/json'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      try {await navigator.share({files:[file],title:'系统研习学习记录'});return;}
      catch(e){if(e.name==='AbortError')return;}
    }
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
    notify('请将备份保存到“文件”中');
  }
  document.getElementById('import-file').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>2*1024*1024)throw new Error('文件过大，请选择学习记录 JSON');
      const payload=JSON.parse(await file.text());let incoming;
      if(payload.app==='Agent Infra Offline' && payload.version===1)incoming=validState(payload.state);
      else if(payload.handbook==='Agent Harness AI Infra' && payload.scores)incoming=validState({...initial(),scores:payload.scores});
      else throw new Error('这不是系统研习或电脑版手册的备份文件');
      state.read={...state.read,...incoming.read};state.bookmarks={...state.bookmarks,...incoming.bookmarks};state.scores={...state.scores,...incoming.scores};
      save();settings();notify(storageOK?'备份已合并；同一题的自评分采用备份值':'已合并到当前会话，但本机存储失败，请重新导出');
    }catch(err){notify(err.message || '无法读取备份');}
    e.target.value='';
  });
  function savePosition(){if(activeQ){state.positions[activeQ]=window.scrollY;save();}}
  window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(savePosition,180);},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')savePosition();});
  window.addEventListener('pagehide',savePosition);
  function render(){
    clearTimeout(scrollTimer);savePosition();activeQ=null;
    let route;try{route=decodeURIComponent(location.hash.slice(1)).split('/');}catch(_){route=['home'];}
    const [name,arg]=route;
    if(name==='q')question(arg);else if(name==='chapter')chapter(arg);else if(name==='library')library(arg);else if(name==='bookmarks')bookmarks();else if(name==='settings')settings();else home();
    const tab = name==='q'?'home':name==='chapter'?'library':['library','bookmarks','settings'].includes(name)?name:'home';
    document.querySelectorAll('[data-tab]').forEach(a=>{if(a.dataset.tab===tab)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    document.title = activeQ ? qmap.get(activeQ).title+' · 系统研习' : '系统研习 · Agent / AI Infra';
    const position = activeQ ? state.positions[activeQ] || 0 : 0;
    requestAnimationFrame(()=>window.scrollTo(0,position));
  }
  function offlineStatus(message,ready=false){
    offlineMessage=message;offlineReady=ready;
    const indicator=document.getElementById('offline-indicator');
    indicator.textContent=ready?'离线已就绪':message;indicator.classList.toggle('ready',ready);
    const detail=document.getElementById('offline-detail');if(detail)detail.textContent=message;
  }
  function workerStatus(worker,type='CHECK_OFFLINE'){
    return new Promise((resolve,reject)=>{
      const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();reject(new Error('检查离线内容超时，请重试'));},type==='REPAIR_OFFLINE'?25000:12000);
      channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};
      worker.postMessage({type},[channel.port2]);
    });
  }
  async function checkOffline(manual=false){
    if(!('serviceWorker' in navigator)||!window.isSecureContext){offlineStatus('请通过 HTTPS 安装链接打开');return;}
    try{
      offlineStatus('正在检查离线内容…');
      // An offline launch must work even when registration/update needs a network.
      if(navigator.serviceWorker.controller){
        let existing=await workerStatus(navigator.serviceWorker.controller);
        if(!existing.ready && navigator.onLine){offlineStatus('正在补全离线内容…');existing=await workerStatus(navigator.serviceWorker.controller,'REPAIR_OFFLINE');}
        if(existing.ready){
          offlineStatus(`离线已就绪：240 道题及全部补充内容已保存。${navigator.onLine?'现在可以断网学习。':'当前正在离线使用。'}`,true);
          if(manual && navigator.storage?.persist)await navigator.storage.persist().catch(()=>false);
          if(manual)notify('已检查：完整内容可离线使用');
          if(navigator.onLine)navigator.serviceWorker.getRegistration('./').then(r=>r?.update()).catch(()=>{});
          return;
        }
      }
      swRegistration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
      // A rejected installation must not leave an indefinite "preparing" label.
      await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('尚未完成离线下载，请保持联网后重试')),25000))]);
      if(!navigator.serviceWorker.controller){
        await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',changed);reject(new Error('离线服务尚未接管，请重新打开应用'));},8000);function changed(){clearTimeout(timer);resolve();}navigator.serviceWorker.addEventListener('controllerchange',changed,{once:true});});
      }
      const status=await workerStatus(navigator.serviceWorker.controller);
      if(!status.ready)throw new Error('离线内容尚不完整，请联网后重新打开');
      offlineStatus(`离线已就绪：240 道题及全部补充内容已保存。${navigator.onLine?'现在可以断网学习。':'当前正在离线使用。'}`,true);
      if(manual && navigator.storage?.persist)await navigator.storage.persist().catch(()=>false);
      if(manual)notify('已检查：完整内容可离线使用');
    }catch(err){offlineStatus(err.message||'未完成离线下载，请联网重试');}
  }
  function prepareOffline(manual=false){
    if(offlineCheck)return offlineCheck;
    offlineCheck=checkOffline(manual).finally(()=>{offlineCheck=null;});
    return offlineCheck;
  }
  window.addEventListener('hashchange',render);
  window.addEventListener('online',()=>prepareOffline());
  window.addEventListener('offline',()=>prepareOffline());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')prepareOffline();});
  // Optional WebMCP bridge; Safari without the API follows the same normal UI.
  if(document.modelContext?.registerTool){
    const lifecycle=new AbortController();
    const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch(_){}};
    register({name:'open_study_question',title:'打开学习题目',description:'打开指定题目的完整答案并记住阅读位置，不修改自评分。',inputSchema:{type:'object',properties:{questionId:{type:'string',pattern:'^Q[0-9]{3}$'}},required:['questionId'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||Object.keys(input).length!==1||!qmap.has(input.questionId))throw new Error('题号必须为 Q001 至 Q240');history.pushState(null,'','#q/'+input.questionId);render();return{questionId:input.questionId,title:qmap.get(input.questionId).title};}});
    register({name:'get_study_progress',title:'读取学习进度',description:'读取本机已读数量、收藏题号与上次阅读题号。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(!input||Object.keys(input).length)throw new Error('此工具不接受参数');return{readCount:Object.keys(state.read).length,total:240,bookmarks:Object.keys(state.bookmarks),lastQuestion:state.last};}});
    window.addEventListener('pagehide',e=>{if(!e.persisted)lifecycle.abort();},{once:true});
  }
  theme();render();prepareOffline();
})();

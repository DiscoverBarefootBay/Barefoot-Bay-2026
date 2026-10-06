// Controlled preview browser probes. Auth/consent and writes are intercepted.
// Directory fixtures come from the development read pipeline, NOT a live login.
import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const phase = process.argv[2] ?? "before";
const mobile = process.argv.includes("mobile");
const role = process.argv.includes("admin") ? "admin" : "registered";
const pages = JSON.parse(await readFile("/tmp/vendors-before-pages.json", "utf8"));
const categories = JSON.parse(await readFile("/tmp/vendors-before-cats.json", "utf8"));
const summary = phase === "after" ? JSON.parse(await readFile("/tmp/vendors-after-summary.json", "utf8")) : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 9400 + process.pid % 400;
const profile = `/tmp/vendors-probe-${process.pid}`;
const browser = spawn("chromium", ["--headless","--no-sandbox","--disable-dev-shm-usage","--disable-gpu",`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,"about:blank"], {stdio:"ignore"});
let socket;
try {
  let tab;
  for(let i=0;i<60&&!tab;i++){try{tab=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==="page");}catch{} if(!tab)await sleep(200);}
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r=>socket.onopen=r);
  let id=0; const pending=new Map(); const requests=[]; const errors=[];
  let override=null;
  const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  socket.onmessage=async({data})=>{
    const m=JSON.parse(data);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}
    else if(m.method==="Runtime.exceptionThrown")errors.push(m.params.exceptionDetails.text);
    else if(m.method==="Fetch.requestPaused"){
      const {requestId,request}=m.params;const path=new URL(request.url).pathname;
      requests.push(path);
      let body={};let code=200;let delay=0;
      if(path==="/api/user") {body={id:999999,username:"probe",role,isApproved:true,isBlocked:false};delay=100;}
      else if(path.startsWith("/api/legal/"))body={policies:[],outstanding:[],requiresAcceptance:false};
      else if(path==="/api/pages"){body=pages;delay=165;}
      else if(path==="/api/pages/navigation"){body=pages.filter(p=>!p.slug.startsWith("vendors-")).map(({id,slug,title,category,order,isHidden})=>({id,slug,title,category,order,isHidden}));delay=130;}
      else if(path==="/api/pages/vendors-main"){body=pages.find(p=>p.slug==="vendors-main")??{id:1,slug:"vendors-main",title:"Vendors",content:""};delay=130;}
      else if(path==="/api/vendor-categories") {body=categories;delay=130;if(override==="aux-error"){code=503;body={message:"Unavailable"};}}
      else if(path==="/api/vendors/directory"){body=summary;delay=165;if(override==="error"){code=503;body={message:"Unavailable"};}if(override==="empty")body={vendors:[],categories:summary.categories};if(override==="slow")delay=1800;}
      else if(path==="/api/vendors/unvisited"){body={unvisitedSlugs:[pages.find(p=>p.slug.startsWith("vendors-landscaping-"))?.slug]};if(override==="aux-error"){code=503;body={message:"Unavailable"};}}
      else if(path.includes("feature"))body=[{id:1,name:"vendors",displayName:"Vendors",isActive:true,enabledForRoles:["registered","admin"]}];
      else if(path==="/api/community-categories")body=[];
      else if(path==="/api/pages/banner-slides")body={content:"[]"};
      await sleep(delay);
      await send("Fetch.fulfillRequest",{requestId,responseCode:code,responseHeaders:[{name:"Content-Type",value:"application/json"}],body:Buffer.from(JSON.stringify(body)).toString("base64")});
    }
  };
  const ev=async(expression)=>{const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);return r.result.value;};
  const wait=async(expression)=>{for(let i=0;i<450;i++){if(await ev(expression))return;await sleep(100);}throw Error("Timed out: "+await ev("document.body.innerText.slice(0,1500)"));};
  await send("Page.enable");await send("Runtime.enable");await send("Network.enable");
  await send("Fetch.enable",{patterns:[{urlPattern:"*/api/*"}]});
  await send("Emulation.setDeviceMetricsOverride",{width:mobile?390:1365,height:mobile?844:900,deviceScaleFactor:1,mobile});
  await send("Page.addScriptToEvaluateOnNewDocument",{source:`window.__vendorsAt=null;window.__longTasks=[];new PerformanceObserver(list=>window.__longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});new MutationObserver(()=>{if(window.__vendorsAt===null&&document.querySelector('[data-testid^="vendor-banner-"],[data-testid^="vendor-card-"]'))window.__vendorsAt=performance.now();}).observe(document,{childList:true,subtree:true});performance.setResourceTimingBufferSize(10000);`});
  const cards=`!!document.querySelector('[data-testid^="vendor-banner-"],[data-testid^="vendor-card-"]')`;
  await send("Page.navigate",{url:base+"/vendors"});await wait(cards);
  const report=async(kind,since=0)=>console.log(JSON.stringify({phase,role,mobile,kind,fixture:true,...await ev(`({usableMs:Math.round(window.__vendorsAt-${since}),requests:performance.getEntriesByType('resource').filter(e=>e.startTime>=${since}&&/\\/api\\/(pages|vendors\\/directory|vendor-categories|user|legal)/.test(e.name)).map(e=>({path:new URL(e.name).pathname,ms:Math.round(e.duration),bytes:e.decodedBodySize,start:Math.round(e.startTime-${since})})),cards:document.querySelectorAll('[data-testid^="vendor-banner-"],[data-testid^="vendor-card-"]').length})`),errors}));
  await report("cold-direct");
  // In-app transitions preserve the real query cache.
  for(const kind of ["in-app","warm-revisit"]){
    await ev(`history.pushState({},'','/terms');dispatchEvent(new PopStateEvent('popstate'));`);
    await sleep(500);
    const since=await ev("window.__vendorsAt=null;performance.now()");
    await ev(`history.pushState({},'','/vendors');dispatchEvent(new PopStateEvent('popstate'));`);
    await wait(cards);await report(kind,since);
  }
  if(phase==="after"&&!process.argv.includes("--timings-only")){
    for(const mode of ["slow","error","empty","aux-error"]){
      override=mode;await send("Page.navigate",{url:base+"/vendors"});
      if(mode==="slow"){await wait(`!!document.querySelector('[data-testid="status-vendors-loading"]')`);if(await ev(`/No vendors found/.test(document.body.innerText)`))throw Error("False empty");await wait(cards);}
      if(mode==="error"){await wait(`!!document.querySelector('[data-testid="status-vendors-error"]')`);override=null;await ev(`document.querySelector('[data-testid="button-retry-vendors"]').click()`);await wait(cards);}
      if(mode==="empty")await wait(`/No vendors found/.test(document.body?.innerText ?? '')`);
      if(mode==="aux-error")await wait(cards);
    }
    override=null;await send("Page.navigate",{url:base+"/vendors"});await wait(cards);
    await ev(`(()=>{const i=document.querySelector('[data-testid="input-vendor-search"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'zzzz-not-found');i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await wait(`/No vendors match your search/.test(document.body.innerText)`);
    await ev(`document.querySelector('[data-testid="button-clear-vendor-search"]').click()`);await wait(cards);
    if(!mobile)for(const view of ["grid","dual","single"]){await ev(`document.querySelector('[data-testid="vendor-view-${view}"]').click()`);await wait(cards);}
    const click=async(selector)=>{
      await wait(`!!document.querySelector(${JSON.stringify(selector)})`);
      await ev(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
      await sleep(150);
      if(selector==='[data-testid="button-open-vendor-filters"]'){
        await ev(`document.querySelector(${JSON.stringify(selector)}).click()`);
        await wait(`!!document.querySelector('[data-testid="select-vendor-category-mobile"]')`);
        return;
      }
      if(selector.includes("select-vendor-")){
        await ev(`document.querySelector(${JSON.stringify(selector)}).focus()`);
        await send("Input.dispatchKeyEvent",{type:"keyDown",key:" ",code:"Space",windowsVirtualKeyCode:32});
        await send("Input.dispatchKeyEvent",{type:"keyUp",key:" ",code:"Space",windowsVirtualKeyCode:32});
        return;
      }
      const p=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await send("Input.dispatchMouseEvent",{type:"mousePressed",...p,button:"left",clickCount:1});
      await send("Input.dispatchMouseEvent",{type:"mouseReleased",...p,button:"left",clickCount:1});
    };
    if(mobile)await click('[data-testid="button-open-vendor-filters"]');
    await click(`[data-testid="select-vendor-category${mobile?"-mobile":""}"]`);
    await wait(`!!document.querySelector('[role="option"]')`);
    await ev(`(()=>{const o=[...document.querySelectorAll('[role="option"]')].find(o=>o.textContent.includes('Landscaping'));o.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'mouse'}));o.click();})()`);
    await sleep(150);
    await click(`[data-testid="select-vendor-sort${mobile?"-mobile":""}"]`);
    for(const text of ["Name Z–A","Newest Added","Oldest Added","Name A–Z"]){
      await wait(`!!document.querySelector('[role="option"]')`);
      await ev(`(()=>{const o=[...document.querySelectorAll('[role="option"]')].find(o=>o.textContent.includes(${JSON.stringify(text)}));o.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'mouse'}));o.click();})()`);
      await sleep(100);
      if(text!=="Name A–Z")await click(`[data-testid="select-vendor-sort${mobile?"-mobile":""}"]`);
    }
    if(mobile)await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
    for(const disclaimer of ["user","vendor"]){
      await click(`[data-testid="link-${disclaimer}-disclaimer"]`);
      await wait(`!!document.querySelector('[role="dialog"]')`);
      await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
      await sleep(150);
    }
    if(requests.includes("/api/pages")||requests.includes("/api/pages/vendors-main"))throw Error("Directory downloaded full CMS pages");
    console.log(JSON.stringify({phase,role,mobile,checks:"loading/error/retry/empty/aux-errors/search/views/categories/sorts/disclaimers passed",overflow:await ev("document.documentElement.scrollWidth>innerWidth"),errors}));
  }
}finally{socket?.close();browser.kill();await sleep(400);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}

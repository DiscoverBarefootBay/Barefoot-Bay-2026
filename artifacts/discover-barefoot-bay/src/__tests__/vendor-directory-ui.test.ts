import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { vendorDirectoryKey } from "../lib/vendor-directory-cache";

test("real directory shows delayed loading, retry and true empty; refresh/account changes never flash privileged cards", async () => {
  const dir = await mkdtemp(path.join(process.cwd(), ".vendor-ui-test-"));
  const dom = new JSDOM("<div id='root'></div>", { url: "https://fixture.test/vendors", pretendToBeVisual: true });
  const domNames = ["location","history","addEventListener","removeEventListener","dispatchEvent","HTMLElement","Element","Node","Document","DocumentFragment","Event","CustomEvent","MutationObserver","localStorage","requestAnimationFrame","cancelAnimationFrame","getComputedStyle"];
  const names = ["window","document",...domNames,"fetch","IS_REACT_ACT_ENVIRONMENT"];
  const prior = Object.fromEntries(names.map(name => [name,(globalThis as any)[name]]));
  Object.assign(globalThis, { window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,
    CustomEvent:dom.window.CustomEvent,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true });
  for (const name of domNames) {
    const value = (dom.window as any)[name];
    (globalThis as any)[name] = ["addEventListener","removeEventListener","dispatchEvent","requestAnimationFrame","cancelAnimationFrame","getComputedStyle"].includes(name) ? value.bind(dom.window) : value;
  }
  const requests: {resolve:(r:Response)=>void; signal?:AbortSignal}[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    if (!String(url).startsWith("/api/vendors/directory")) return new Response(JSON.stringify({message:"Badge unavailable"}),{status:503});
    return new Promise<Response>(resolve => requests.push({resolve,signal:init?.signal}));
  }) as typeof fetch;
  const client = new QueryClient({defaultOptions:{queries:{placeholderData:[],retry:false}}});
  let root: ReturnType<typeof createRoot> | undefined;
  const response = (vendors: unknown[] = []) => ({categories:[{slug:"landscaping",label:"Landscaping"}],vendors});
  const card = (title: string) => ({slug:`vendors-landscaping-${title}`,title,description:"A vendor",image:null,
    href:"/vendors/landscaping/acme",categorySlug:"landscaping",categoryLabel:"Landscaping",isHidden:title==="Secret",
    createdAt:null,showInDirectory:true,showInCategory:true});
  const tick = async () => { await act(async () => { await new Promise(r=>setTimeout(r,15)); }); };
  const settle = async (index: number, body: unknown, status = 200) => {
    await act(async () => {requests[index].resolve(new Response(JSON.stringify(body),{status}));});
    await tick();
  };
  const text = () => dom.window.document.body.textContent ?? "";
  const skeleton = () => dom.window.document.querySelector('[data-testid="status-vendors-loading"]');
  try {
    const outfile=path.join(dir,"harness.mjs");
    await build({
      stdin:{contents:`
        import React from "react";
        import { QueryClientProvider } from "@tanstack/react-query";
        import { AllVendorsPage } from "@/components/vendors/all-vendors-page";
        import { ProtectedRoute } from "@/lib/protected-route";
        import { Router } from "wouter";
        import { memoryLocation } from "wouter/memory-location";
        import { AuthContext } from "@/hooks/use-auth";
        const location=memoryLocation({path:"/vendors"});
        export default function Harness({client,user,role,guestAllowed=true}) {
          return <QueryClientProvider client={client}><AuthContext.Provider value={{user,effectiveRole:role,isLoading:false,guestAllowed}}>
            <Router hook={location.hook}><ProtectedRoute path="/vendors" component={AllVendorsPage} requiredFeature="VENDORS" /></Router>
          </AuthContext.Provider></QueryClientProvider>;
        }`,resolveDir:process.cwd(),sourcefile:"harness.tsx",loader:"tsx"},
      outfile,bundle:true,format:"esm",platform:"node",packages:"external",jsx:"automatic",
      plugins:[{name:"test-only-auth-and-assets",setup(b){
        b.onResolve({filter:/^react(?:\/.*)?$/},args=>({path:args.path,external:true}));
        b.onResolve({filter:/^@assets\//},()=>({path:"image",namespace:"test-assets"}));
        b.onLoad({filter:/.*/,namespace:"test-assets"},()=>({contents:'export default "/test-image.png";',loader:"js"}));
        b.onResolve({filter:/^(?:@\/hooks\/use-auth|\.\.\/components\/providers\/auth-provider)$/},()=>({path:"auth",namespace:"test"}));
        b.onResolve({filter:/^@\/hooks\/use-flags$/},()=>({path:"flags",namespace:"test"}));
        b.onLoad({filter:/.*/,namespace:"test"},args=>({contents:args.path==="flags"
          ? 'import {useAuth} from "@/hooks/use-auth";export const useFlags=()=>{const a=useAuth();return {isLoading:false,isFeatureEnabled:()=>!!a.user||a.guestAllowed};};'
          : 'import {createContext,useContext} from "react";export const AuthContext=createContext(null);export const useAuth=()=>useContext(AuthContext);',loader:"js"}));
        b.onResolve({filter:/^@\//},args=>{
          const base=path.resolve(process.cwd(),"src",args.path.slice(2));
          return {path:[base,base+".tsx",base+".ts"].find(existsSync)??base};
        });
        b.onLoad({filter:/\.(png|jpe?g|webp|svg)$/},()=>({contents:'export default "/test-image.png";',loader:"js"}));
      }}],
    });
    const Harness=(await import(pathToFileURL(outfile).href)).default;
    root=createRoot(dom.window.document.getElementById("root")!);
    const render=async(id:number|null,role="registered",guestAllowed=true)=>{
      await act(async()=>root!.render(createElement(Harness,{client,user:id===null?null:{id,role},role,guestAllowed})));
      await tick();
    };
    await render(1);
    assert.ok(skeleton());assert.ok(!text().includes("No vendors found"));
    await settle(0,{message:"Unavailable"},503);
    assert.ok(text().includes("Unable to load vendors"));assert.ok(!text().includes("No vendors found"));
    await act(async()=>dom.window.document.querySelector<HTMLButtonElement>('[data-testid="button-retry-vendors"]')!.click());
    await settle(1,response());
    assert.ok(text().includes("No vendors found"));assert.equal(skeleton(),null);
    await render(2);
    assert.ok(skeleton());assert.ok(!text().includes("No vendors found"));
    await settle(2,response([card("Acme")]));
    assert.ok(text().includes("Acme"));assert.ok(!text().includes("No vendors found"));
    // Badge failures are intentionally independent of the cards.
    for (let i=0;i<30&&!text().includes("badges are temporarily unavailable");i++) await tick();
    assert.ok(text().includes("badges are temporarily unavailable"));
    const count=requests.length;
    await act(async()=>root!.render(null));await render(2);
    assert.equal(requests.length,count);assert.ok(text().includes("Acme"));
    await render(2,"admin");
    assert.ok(skeleton());assert.ok(!text().includes("Acme"));
    await settle(3,response([card("Secret")]));
    assert.ok(text().includes("Secret"));
    await render(2);
    assert.ok(skeleton());assert.ok(!text().includes("Secret"));
    await settle(4,response([card("Acme")]));
    await act(async()=>{ void client.invalidateQueries({queryKey:["/api/vendors/directory"]}); });
    assert.ok(text().includes("Acme"));assert.equal(skeleton(),null);
    await settle(5,{message:"Unavailable"},503);
    assert.ok(text().includes("Unable to refresh vendors"));assert.ok(text().includes("Acme"));
    assert.ok(!text().includes("No vendors found"));
    // The real route guard admits allowed guests; their directory must actually
    // request public data rather than remain on a disabled-query skeleton.
    await render(null,"guest");
    assert.ok(skeleton());assert.ok(!text().includes("Acme"));
    await settle(6,response([card("Public guest vendor")]));
    assert.equal(skeleton(),null);assert.ok(text().includes("Public guest vendor"));
    assert.equal(client.getQueryData(vendorDirectoryKey(2,"admin")),undefined);
    const afterGuest=requests.length;
    await render(null,"guest",false);
    assert.equal(skeleton(),null);
    assert.ok(!text().includes("Public guest vendor"));
    assert.equal(requests.length,afterGuest,"denied guest route never mounts the directory");
  } finally {
    if(root)await act(async()=>root!.unmount());
    client.clear();dom.window.close();Object.assign(globalThis,prior);
    await rm(dir,{recursive:true,force:true});
  }
});

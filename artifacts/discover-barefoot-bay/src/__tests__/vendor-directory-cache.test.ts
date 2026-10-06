import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { installVendorDirectoryInvalidation, vendorDirectoryKey } from "../lib/vendor-directory-cache";
import { vendorCategoryHref } from "../lib/vendor-category-url";
test("directory cache is scoped by account and effective role, not global placeholder data",async()=>{
  const client=new QueryClient({defaultOptions:{queries:{placeholderData:[]}}});
  const admin=vendorDirectoryKey(1,"admin"),resident=vendorDirectoryKey(1,"registered"),other=vendorDirectoryKey(2,"registered");
  client.setQueryData(admin,{vendors:[{isHidden:true}]});
  assert.equal(client.getQueryData(resident),undefined);assert.equal(client.getQueryData(other),undefined);
  let resolve!: (data: any)=>void;
  const observer=new QueryObserver(client,{queryKey:resident,queryFn:()=>new Promise(r=>resolve=r),placeholderData:undefined,retry:false});
  const unsub=observer.subscribe(()=>{});
  assert.equal(observer.getCurrentResult().isPending,true);
  assert.equal(observer.getCurrentResult().data,undefined);
  resolve({vendors:[],categories:[]});await new Promise(r=>setTimeout(r,0));
  assert.equal(observer.getCurrentResult().isSuccess,true);
  assert.deepEqual(observer.getCurrentResult().data,{vendors:[],categories:[]});
  unsub();client.clear();
});
test("vendor, category and moderation changes invalidate all directory scopes without rewriting global defaults",async()=>{
  const client=new QueryClient();const stop=installVendorDirectoryInvalidation(client);
  const scopes=[vendorDirectoryKey(1,"admin"),vendorDirectoryKey(2,"registered")];
  for(const root of ["/api/pages","/api/vendor-categories","dmca-content-status"]){
    scopes.forEach(key=>client.setQueryData(key,{vendors:[],categories:[]}));
    client.setQueryData([root],[]);
    await client.invalidateQueries({queryKey:[root]});
    for(const key of scopes)assert.equal(client.getQueryState(key)?.isInvalidated,true);
  }
  stop();client.clear();
});
test("category URLs keep the legacy space and compound repairs",()=>{
  assert.equal(vendorCategoryHref("vendors-landscaping-tst vendor","landscaping"),"/vendors/landscaping/tst%20vendor");
  assert.equal(vendorCategoryHref("vendors-home-services-services-acme","home-services"),"/vendors/home-services/acme");
  assert.equal(vendorCategoryHref("vendors-food-and-dining-cafe","food-dining"),"/vendors/food-dining/cafe");
  assert.equal(vendorCategoryHref("vendors-technology-and-electronics-computer-healthcare","technology-and-electronics"),"/vendors/technology-and-electronics/computer-healthcare");
});
test("fresh revisits reuse real data; a failed refresh retains cards, while initial failure is not empty success",async()=>{
  const client=new QueryClient();const key=vendorDirectoryKey(7,"registered");
  let calls=0, fail=false;
  const options={queryKey:key,placeholderData:undefined,staleTime:60000,retry:false,
    queryFn:async()=>{calls++;if(fail)throw Error("Unavailable");return {vendors:[{title:"Acme"}],categories:[]};}};
  await client.fetchQuery(options);
  const observer=new QueryObserver(client,options);
  const stop=observer.subscribe(()=>{});
  assert.equal(observer.getCurrentResult().data?.vendors.length,1);assert.equal(calls,1);
  fail=true;await observer.refetch();
  assert.equal(observer.getCurrentResult().isError,true);
  assert.equal(observer.getCurrentResult().data?.vendors[0].title,"Acme");
  const other=new QueryObserver(client,{...options,queryKey:vendorDirectoryKey(8,"registered")});
  const stopOther=other.subscribe(()=>{});
  await other.refetch();
  assert.equal(other.getCurrentResult().isError,true);assert.equal(other.getCurrentResult().data,undefined);
  stop();stopOther();client.clear();
});

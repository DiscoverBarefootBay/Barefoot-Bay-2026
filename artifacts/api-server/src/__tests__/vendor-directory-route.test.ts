import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { createVendorRouter } from "../routes/vendors";
import type { IStorage } from "../storage";

test("directory HTTP contract rejects anonymous callers, enforces hidden scope and fails explicitly", async () => {
  const includes: boolean[] = [];
  let fail = false;
  const rows = [
    {id:1,slug:"vendors-landscaping-public",title:"Public",content:'<p>Hello</p>',isHidden:false,visibilityStatus:"published"},
    {id:2,slug:"vendors-landscaping-hidden",title:"Admin hidden",content:"Private HTML",isHidden:true,visibilityStatus:"published"},
    {id:3,slug:"vendors-landscaping-dmca",title:"Removed",content:"Must not leak",isHidden:false,visibilityStatus:"dmca_hidden",updatedBy:42},
    {id:4,slug:"vendors-landscaping-moderated",title:"Moderated",content:"Must not leak",isHidden:false,visibilityStatus:"moderation_hidden",updatedBy:42},
  ];
  const app = express();
  // Test-only synthetic identity; does not modify app authentication or any DB row.
  app.use((req: any, _res, next) => {
    const role = req.header("x-test-role");
    req.isAuthenticated = () => !!role;
    if (role) req.user = {id: role === "owner" ? 42 : 10,role: role === "owner" ? "registered" : role};
    req._dmcaPermissions = new Set();
    next();
  });
  app.use("/api/vendors", createVendorRouter({
    getVendorCategories: async () => [{slug:"landscaping",name:"Landscaping",isHidden:false}],
  } as unknown as IStorage, async includeHidden => {
    includes.push(includeHidden);
    if (fail) throw Error("Unavailable");
    return rows.filter(p => includeHidden || !p.isHidden);
  }));
  const server = app.listen(0,"127.0.0.1");
  await new Promise<void>(r => server.once("listening",r));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/vendors/directory`;
  try {
    assert.equal((await fetch(base)).status,401);
    for (const role of ["registered","admin","owner"]) {
      const res = await fetch(`${base}?includeHidden=true`,{headers:{"x-test-role":role}});
      assert.equal(res.status,200);
      assert.match(res.headers.get("cache-control") ?? "", /private/);
      const body = await res.json();
      assert.equal(body.vendors.length,role==="registered"?1:2);
      assert.ok(body.vendors.every((v: any)=>!("content" in v)&&!("updatedBy" in v)&&!("dmcaCaseId" in v)));
      assert.ok(!JSON.stringify(body).includes("Must not leak") || role === "owner");
      assert.ok(!body.vendors.some((v:any)=>v.slug.endsWith("moderated")));
    }
    assert.deepEqual(includes,[false,true,false]);
    const viewAs = await fetch(`${base}?includeHidden=false`,{headers:{"x-test-role":"admin"}});
    assert.equal((await viewAs.json()).vendors.length,1);
    assert.equal((await fetch(`${base}?includeHidden=oops`,{headers:{"x-test-role":"admin"}})).status,400);
    fail = true;
    const error = await fetch(base,{headers:{"x-test-role":"registered"}});
    assert.equal(error.status,500);
    assert.match((await error.json()).message,/try again/i);
  } finally {
    await new Promise<void>(resolve => server.close(()=>resolve()));
  }
});

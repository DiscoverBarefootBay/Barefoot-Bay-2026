import assert from "node:assert/strict";
import { test } from "node:test";
import { projectVendorDirectory, directoryVendorName, vendorMatchesCategory, vendorMatchesCategoryPage } from "../vendor-directory-summary";
import { filterForViewer } from "../dmca/content-visibility";
import { readVendorDirectoryPages } from "../vendor-directory-read";
import { PgDialect } from "drizzle-orm/pg-core";
const categories = [{slug:"home-services",name:"Home"},{slug:"food-dining",name:"Food"},{slug:"landscaping",name:"Landscaping"}];
const page = (slug: string, extra = {}) => ({slug,title:"Vendor",content:'<p>A &amp; B</p><img src="/uploads/content-media/photo.jpg">',createdAt:new Date("2026-01-01"),...extra});
test("summary keeps legacy categorization, spaces, category-specific URLs and skips index pages", () => {
  const rows = ["vendors-main","vendors-home-services","vendors-home-service-acme","vendors-food-and-dining-cafe",
    "vendors-landscaping-tst vendor","vendors-landscaping tst vendor","community-government"].map(s=>page(s));
  const result = projectVendorDirectory(rows,categories);
  assert.equal(result.vendors.length,4);
  assert.ok(result.vendors.some(v=>v.categorySlug==="food-dining"));
  assert.ok(result.vendors.some(v=>v.href==="/vendors/landscaping/tst%20vendor"));
  assert.equal(directoryVendorName("vendors-home-services-acme",categories),"acme");
  assert.equal(vendorMatchesCategory("vendors-home-services","home-services",categories),false);
  assert.equal(vendorMatchesCategory("vendors-home-service-acme","home-services",categories),false);
  assert.equal(vendorMatchesCategoryPage("vendors-home-service-acme","home-services"),true);
  assert.equal(vendorMatchesCategoryPage("vendors-food-cafe","food-dining"),false);
  for(const v of result.vendors){assert.equal(v.description,"A & B");assert.equal(v.image,"/uploads/content-media/photo.jpg");assert.equal((v as any).content,undefined);}
});
test("central visibility runs before snippet or image projection; list staff permissions are not detail permissions", () => {
  const rows = [
    page("vendors-landscaping-public",{visibilityStatus:"published",updatedBy:1}),
    page("vendors-landscaping-dmca",{visibilityStatus:"dmca_hidden",updatedBy:1}),
    page("vendors-landscaping-moderated",{visibilityStatus:"moderation_hidden",updatedBy:1}),
  ];
  const visible=(viewer: any)=>projectVendorDirectory(filterForViewer(rows,viewer,(p:any)=>p.updatedBy),categories).vendors;
  assert.equal(visible({userId:2,canViewHidden:false}).length,1);
  const owned=visible({userId:1,canViewHidden:false});
  assert.equal(owned.length,2);assert.equal(owned[1].contentVisibility?.removed,true);
  assert.equal(visible({userId:2,canViewHidden:true,canViewModerated:true}).length,1);
});
test("projection omits privileged policy metadata, inline image payloads and executable HTML",()=>{
  const result=projectVendorDirectory([page("vendors-landscaping-safe",{
    content:'<script>secret()</script><style>.hidden{}</style><p>Hello</p><img src="javascript:evil">',
    contentVisibility:{removed:true,status:"dmca_hidden",reason:"private",dmcaCaseId:9},
  })],categories).vendors[0];
  assert.equal(result.description,"Hello");assert.equal(result.image,null);
  assert.deepEqual(result.contentVisibility,{removed:true,status:"dmca_hidden"});
});
test("SQL filters vendors at DB boundary and keeps list duplicate ordering and hidden-before-dedup semantics",async()=>{
  let calls = 0;
  for (const includeHidden of [false, true]) {
    let query: any;
    const result = await readVendorDirectoryPages(includeHidden, { execute: async (statement: any) => {
      calls++; query = new PgDialect().sqlToQuery(statement); return {rows:[]};
    } } as any);
    assert.deepEqual(result,[]);
    assert.match(query.sql,/DISTINCT ON \(slug\)/);
    assert.match(query.sql,/WHERE slug LIKE 'vendors-%' AND/);
    assert.match(query.sql,/ORDER BY slug, "order", updated_at DESC, id DESC/);
    assert.deepEqual(query.params,[includeHidden]);
  }
  assert.equal(calls,2);
});

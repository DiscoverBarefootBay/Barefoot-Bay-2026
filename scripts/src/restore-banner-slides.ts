import { db, pool, pageContents } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

type BannerSlide = {
  src: string;
  alt: string;
  caption: string;
  link: string;
  buttonText: string;
  bgPosition: string;
  mediaType?: "image" | "video";
};

const VERIFIED_BANNER_SLIDES: BannerSlide[] = [
  {
    src: "/api/storage-proxy/BANNER/banner-slides/bannerImage-1779447389219-374465747.jpg",
    alt: "Memorial Day Remembrance",
    caption: "Memorial Day Remembrance",
    link: "/events/12376",
    buttonText: "Events Begin at 11am",
    bgPosition: "bottom center",
  },
  {
    src: "/api/storage-proxy/BANNER/banner-slides/bannerImage-1779634962196-258141433.jpg",
    alt: "The Tattler - June Issue",
    caption: "The Tattler - June Issue",
    link: "/forum/post/474",
    buttonText: "Leave your Comments",
    bgPosition: "top center",
  },
  {
    src: "/api/storage-proxy/BANNER/banner-slides/bannerImage-1779404883639-916195021.jpg",
    alt: "Summer Golf in Barefoot Bay",
    caption: "Summer Golf in Barefoot Bay",
    link: "/forum/post/473",
    buttonText: "New Summer Rates!",
    bgPosition: "top center",
  },
  {
    src: "/api/storage-proxy/BANNER/banner-slides/bannerImage-1778098704547-481234481.png",
    alt: "Junior Golf Program Returns",
    caption: "Junior Golf Program Returns",
    link: "/forum/post/470",
    buttonText: "Read Here",
    bgPosition: "center",
  },
  {
    src: "/api/storage-proxy/BANNER/banner-slides/bannerImage-1762105636645-70659954.jpg",
    alt: "Advertise Your Yard Sale/Open House",
    caption: "Advertise Your Yard Sale/Open House",
    link: "/for-sale",
    buttonText: "Check Our For Sale Listings",
    bgPosition: "center",
  },
  {
    src: "/api/storage-proxy/BANNER/banner-slides/bannerImage-1748470568704-557694426.jpg",
    alt: "Where is Barefoot Bay?",
    caption: "Where is Barefoot Bay?",
    link: "/forum/post/250",
    buttonText: "Find us!",
    bgPosition: "center",
  },
  {
    src: "/api/storage-proxy/BANNER/banner-slides/bannerImage-1767621084651-648799319.jpg",
    alt: "Florida's Best Kept Secret",
    caption: "Florida's Best Kept Secret",
    link: "/forum/post/232",
    buttonText: "Discover!",
    bgPosition: "top center",
  },
];

function filenameFromSrc(src: string): string {
  return src.split("/").pop() ?? "";
}

async function verifySlideAvailable(slide: BannerSlide, baseUrl: string): Promise<boolean> {
  const filename = filenameFromSrc(slide.src);
  if (!filename) return false;
  const url = `${baseUrl}/api/storage-proxy/direct-banner/${filename}`;
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const baseUrl = process.env.BANNER_VERIFY_BASE_URL ?? "http://localhost:80";

  console.log(`Verifying ${VERIFIED_BANNER_SLIDES.length} candidate slide URLs against ${baseUrl}...`);
  const checks = await Promise.all(
    VERIFIED_BANNER_SLIDES.map(async (slide) => ({
      slide,
      ok: await verifySlideAvailable(slide, baseUrl),
    })),
  );

  for (const { slide, ok } of checks) {
    console.log(`  [${ok ? "OK " : "MISS"}] ${slide.src}`);
  }

  const verified = checks.filter((c) => c.ok).map((c) => c.slide);
  if (verified.length < 4) {
    console.error(
      `Refusing to restore: only ${verified.length} of ${VERIFIED_BANNER_SLIDES.length} slide URLs are currently resolvable (need at least 4).`,
    );
    process.exit(1);
  }
  console.log(`${verified.length} slides verified.`);

  const rows = await db
    .select({ id: pageContents.id, slug: pageContents.slug, content: pageContents.content })
    .from(pageContents)
    .where(eq(pageContents.slug, "banner-slides"));

  if (rows.length === 0) {
    console.error("No page_contents row with slug='banner-slides' found.");
    process.exit(1);
  }

  const emptyRows = rows.filter((r) => !r.content || r.content === "[]" || r.content.trim() === "");
  if (emptyRows.length === 0) {
    console.log("All banner-slides rows already have non-empty content; nothing to restore.");
    await pool.end();
    return;
  }

  const payload = JSON.stringify(verified);
  console.log(`Found ${emptyRows.length} empty banner-slides row(s) (ids: ${emptyRows.map((r) => r.id).join(", ")}).`);

  if (!apply) {
    console.log(`Dry run. Re-run with --apply to write ${verified.length}-slide payload (${payload.length} bytes).`);
    await pool.end();
    return;
  }

  const result = await db
    .update(pageContents)
    .set({ content: payload, updatedAt: sql`NOW()` })
    .where(eq(pageContents.slug, "banner-slides"))
    .returning({ id: pageContents.id, updatedAt: pageContents.updatedAt });

  console.log(`Updated ${result.length} row(s):`);
  for (const row of result) {
    console.log(`  id=${row.id} updated_at=${row.updatedAt}`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("Failed to restore banner-slides content:", err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});

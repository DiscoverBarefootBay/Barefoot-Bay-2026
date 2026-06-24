import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateOGTags,
  generateHTMLWithOGTags,
  stripHtml,
  extractFirstImageFromHtml,
  truncateText,
  isSocialMediaCrawler,
  normalizeImageUrl,
} from '../og-tags-generator';

describe('generateOGTags', () => {
  it('emits the required OG, Twitter, and description tags for a basic page', () => {
    const out = generateOGTags({
      title: 'Hello',
      description: 'A nice page',
      url: 'https://example.com/x',
    });
    assert.match(out, /property="og:title" content="Hello"/);
    assert.match(out, /property="og:description" content="A nice page"/);
    assert.match(out, /property="og:url" content="https:\/\/example\.com\/x"/);
    assert.match(out, /property="og:type" content="website"/);
    assert.match(out, /property="og:site_name" content="BarefootBay\.com"/);
    assert.match(out, /name="twitter:card" content="summary"/);
    assert.match(out, /name="description" content="A nice page"/);
  });

  it('uses summary_large_image when an image is provided and includes image size tags', () => {
    const out = generateOGTags({
      title: 'T',
      description: 'D',
      url: 'https://x',
      image: 'https://x/img.jpg',
      imageWidth: 800,
      imageHeight: 400,
    });
    assert.match(out, /name="twitter:card" content="summary_large_image"/);
    assert.match(out, /property="og:image" content="https:\/\/x\/img\.jpg"/);
    assert.match(out, /property="og:image:width" content="800"/);
    assert.match(out, /property="og:image:height" content="400"/);
  });

  it('escapes HTML-special characters in title/description/url/image', () => {
    const out = generateOGTags({
      title: '<bad> & "quote"',
      description: "It's <html>",
      url: 'https://x?a=1&b=2',
      image: 'https://x/"q".jpg',
    });
    assert.match(out, /og:title" content="&lt;bad&gt; &amp; &quot;quote&quot;"/);
    assert.match(out, /og:description" content="It&#039;s &lt;html&gt;"/);
    assert.match(out, /og:url" content="https:\/\/x\?a=1&amp;b=2"/);
    assert.match(out, /og:image" content="https:\/\/x\/&quot;q&quot;\.jpg"/);
    assert.doesNotMatch(out, /<bad>/);
  });

  it('emits article-only tags when type is article', () => {
    const out = generateOGTags({
      title: 'A',
      description: 'D',
      url: 'https://x',
      type: 'article',
      author: 'Alice',
      publishedTime: '2024-01-01',
      modifiedTime: '2024-01-02',
    });
    assert.match(out, /property="og:type" content="article"/);
    assert.match(out, /property="article:author" content="Alice"/);
    assert.match(out, /property="article:published_time" content="2024-01-01"/);
    assert.match(out, /property="article:modified_time" content="2024-01-02"/);
  });
});

describe('generateHTMLWithOGTags', () => {
  it('replaces existing OG/twitter/description tags and updates the <title>', () => {
    const base = `<html><head>
      <title>Old</title>
      <meta property="og:title" content="OldOG" />
      <meta name="twitter:card" content="summary" />
      <meta name="description" content="old desc" />
    </head><body></body></html>`;
    const out = generateHTMLWithOGTags(
      { title: 'New', description: 'New desc', url: 'https://x' },
      base,
    );
    assert.match(out, /<title>New<\/title>/);
    assert.doesNotMatch(out, /OldOG/);
    assert.doesNotMatch(out, /old desc/);
    assert.match(out, /og:title" content="New"/);
  });
});

describe('stripHtml / extractFirstImageFromHtml / truncateText', () => {
  it('stripHtml removes tags but preserves text', () => {
    assert.equal(stripHtml('<p>Hello <b>world</b></p>'), 'Hello world');
  });

  it('extractFirstImageFromHtml returns the first src or undefined', () => {
    assert.equal(
      extractFirstImageFromHtml('<p><img src="https://x/a.png" /><img src="b.png" /></p>'),
      'https://x/a.png',
    );
    assert.equal(extractFirstImageFromHtml('<p>no images here</p>'), undefined);
    assert.equal(extractFirstImageFromHtml(''), undefined);
  });

  it('truncateText leaves short text and ellipsizes long text', () => {
    assert.equal(truncateText('hello', 10), 'hello');
    assert.equal(truncateText('abcdefghijkl', 8), 'abcde...');
    assert.equal(truncateText('abcdefghijkl', 8).length, 8);
  });
});

describe('isSocialMediaCrawler', () => {
  it('returns true for known crawler UAs (case-insensitive)', () => {
    assert.equal(isSocialMediaCrawler('Mozilla/5.0 facebookexternalhit/1.1'), true);
    assert.equal(isSocialMediaCrawler('TWITTERBOT/1.0'), true);
    assert.equal(isSocialMediaCrawler('Discordbot/2.0'), true);
  });

  it('returns false for empty UA and normal browser UAs', () => {
    assert.equal(isSocialMediaCrawler(''), false);
    assert.equal(
      isSocialMediaCrawler('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36'),
      false,
    );
  });
});

describe('normalizeImageUrl', () => {
  it('returns absolute URLs unchanged', () => {
    assert.equal(normalizeImageUrl('https://x/a.png', 'https://base'), 'https://x/a.png');
    assert.equal(normalizeImageUrl('http://x/a.png', 'https://base'), 'http://x/a.png');
  });

  it('joins root-relative paths to the base URL', () => {
    assert.equal(normalizeImageUrl('/img/a.png', 'https://base'), 'https://base/img/a.png');
  });

  it('joins relative paths to the base URL with a slash', () => {
    assert.equal(normalizeImageUrl('img/a.png', 'https://base'), 'https://base/img/a.png');
  });

  it('returns undefined when no image url is provided', () => {
    assert.equal(normalizeImageUrl(undefined, 'https://base'), undefined);
  });
});

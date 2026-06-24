interface OGTagsOptions {
  title: string;
  description: string;
  url: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  type?: 'website' | 'article' | 'product';
  siteName?: string;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
}

export function generateOGTags(options: OGTagsOptions): string {
  const {
    title,
    description,
    url,
    image,
    imageWidth = 1200,
    imageHeight = 630,
    type = 'website',
    siteName = 'BarefootBay.com',
    author,
    publishedTime,
    modifiedTime,
  } = options;

  const tags: string[] = [];

  // Required OG tags
  tags.push(`<meta property="og:title" content="${escapeHtml(title)}" />`);
  tags.push(`<meta property="og:description" content="${escapeHtml(description)}" />`);
  tags.push(`<meta property="og:url" content="${escapeHtml(url)}" />`);
  tags.push(`<meta property="og:type" content="${type}" />`);
  tags.push(`<meta property="og:site_name" content="${siteName}" />`);

  // Image tags (if provided)
  if (image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`);
    tags.push(`<meta property="og:image:width" content="${imageWidth}" />`);
    tags.push(`<meta property="og:image:height" content="${imageHeight}" />`);
    tags.push(`<meta property="og:image:type" content="image/jpeg" />`);
    tags.push(`<meta property="og:image:secure_url" content="${escapeHtml(image)}" />`);
  }

  // Twitter Card tags
  tags.push(`<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`);
  tags.push(`<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  tags.push(`<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  if (image) {
    tags.push(`<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  }

  // Article-specific tags
  if (type === 'article') {
    if (author) {
      tags.push(`<meta property="article:author" content="${escapeHtml(author)}" />`);
    }
    if (publishedTime) {
      tags.push(`<meta property="article:published_time" content="${publishedTime}" />`);
    }
    if (modifiedTime) {
      tags.push(`<meta property="article:modified_time" content="${modifiedTime}" />`);
    }
  }

  // Standard meta description
  tags.push(`<meta name="description" content="${escapeHtml(description)}" />`);

  return tags.join('\n    ');
}

export function generateHTMLWithOGTags(options: OGTagsOptions, baseHtml: string): string {
  const ogTags = generateOGTags(options);
  
  // Replace the existing og:title and og:description in the base HTML
  let updatedHtml = baseHtml;
  
  // Remove existing OG tags and meta description to avoid duplicates
  updatedHtml = updatedHtml.replace(
    /<meta\s+property="og:[^"]*"\s+content="[^"]*"\s*\/>/gi,
    ''
  );
  updatedHtml = updatedHtml.replace(
    /<meta\s+name="twitter:[^"]*"\s+content="[^"]*"\s*\/>/gi,
    ''
  );
  updatedHtml = updatedHtml.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/gi,
    ''
  );
  
  // Inject new OG tags before the closing </head> tag
  updatedHtml = updatedHtml.replace(
    '</head>',
    `    ${ogTags}\n  </head>`
  );
  
  // Update the page title
  updatedHtml = updatedHtml.replace(
    /<title>.*?<\/title>/,
    `<title>${escapeHtml(options.title)}</title>`
  );
  
  return updatedHtml;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export function extractFirstImageFromHtml(html: string): string | undefined {
  if (!html) return undefined;
  
  // Match img tags with src attribute
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/i;
  const match = html.match(imgRegex);
  
  if (match && match[1]) {
    return match[1];
  }
  
  return undefined;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

export function isSocialMediaCrawler(userAgent: string): boolean {
  if (!userAgent) return false;
  
  const crawlers = [
    'facebookexternalhit',
    'facebookcatalog',
    'Facebot',
    'Twitterbot',
    'LinkedInBot',
    'WhatsApp',
    'Pinterest',
    'Slackbot',
    'TelegramBot',
    'SkypeUriPreview',
    'Googlebot',
    'bingbot',
    'Discordbot',
  ];
  
  const userAgentLower = userAgent.toLowerCase();
  return crawlers.some(crawler => userAgentLower.includes(crawler.toLowerCase()));
}

export function normalizeImageUrl(imageUrl: string | undefined, baseUrl: string): string | undefined {
  if (!imageUrl) return undefined;
  
  // If already absolute URL, return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Make relative URLs absolute
  if (imageUrl.startsWith('/')) {
    return `${baseUrl}${imageUrl}`;
  }
  
  return `${baseUrl}/${imageUrl}`;
}

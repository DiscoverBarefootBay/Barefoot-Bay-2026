/**
 * Utility for creating clean text previews from HTML content
 * Handles media-only content gracefully by providing descriptive previews
 */

export function createTextPreview(htmlContent: string, maxLength: number = 150, customPreview?: string): string {
  // If there's a custom preview, use it directly
  if (customPreview && customPreview.trim() !== '') {
    return customPreview.substring(0, maxLength) + (customPreview.length > maxLength ? '...' : '');
  }
  
  if (!htmlContent || htmlContent.trim() === '') {
    return 'No preview available';
  }
  
  // Create a temporary DOM element to properly parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  
  // Remove script and style tags completely (they shouldn't contribute to preview)
  const scripts = tempDiv.querySelectorAll('script');
  const styles = tempDiv.querySelectorAll('style');
  scripts.forEach(script => script.remove());
  styles.forEach(style => style.remove());
  
  // Extract text content after cleaning (automatically handles all HTML properly)
  const textContent = tempDiv.textContent || tempDiv.innerText || '';
  
  // Clean up extra whitespace early for better processing
  const cleanText = textContent.replace(/\s+/g, ' ').trim();
  
  // For empty or very short content after cleanup, check for media elements
  if (cleanText === '' || cleanText.length < 10) {
    const videos = tempDiv.querySelectorAll('video');
    const images = tempDiv.querySelectorAll('img');
    const audio = tempDiv.querySelectorAll('audio');
    const galleries = tempDiv.querySelectorAll('[data-media-gallery]');
    const iframes = tempDiv.querySelectorAll('iframe');
    
    // Check for media galleries first
    if (galleries.length > 0) {
      const totalItems = Array.from(galleries).reduce((count, gallery) => {
        const items = gallery.querySelectorAll('[data-media-item]');
        return count + items.length;
      }, 0);
      return `📸 Media gallery (${totalItems} item${totalItems !== 1 ? 's' : ''})`;
    }
    
    // Check individual media types
    if (videos.length > 0) {
      return `📹 Video content (${videos.length} video${videos.length !== 1 ? 's' : ''})`;
    }
    
    if (images.length > 0) {
      return `🖼️ Image content (${images.length} image${images.length !== 1 ? 's' : ''})`;
    }
    
    if (audio.length > 0) {
      return `🎵 Audio content (${audio.length} audio${audio.length !== 1 ? 's' : ''})`;
    }
    
    // Check for embedded content like YouTube iframes
    if (iframes.length > 0) {
      // Check if it's a YouTube embed
      const youtubeIframe = Array.from(iframes).find(iframe => 
        iframe.src && iframe.src.includes('youtube.com')
      );
      if (youtubeIframe) {
        return '🎥 YouTube video content';
      }
      return `🌐 Embedded content (${iframes.length} embed${iframes.length !== 1 ? 's' : ''})`;
    }
    
    // If still no meaningful content, check if it might be a special post type
    const originalLower = htmlContent.toLowerCase();
    if (originalLower.includes('live') && originalLower.includes('chat')) {
      return '💬 Live chat feature';
    }
    if (originalLower.includes('ascii') || cleanText.includes('██') || cleanText.includes('░░')) {
      return '🎨 ASCII art content';
    }
    
    return 'Interactive content';
  }
  
  // For ASCII art or special formatted content, provide a more descriptive preview
  if (cleanText.includes('██') || cleanText.includes('░░') || cleanText.includes('▓▒')) {
    // Try to extract a meaningful title or description from ASCII content
    const lines = cleanText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const meaningfulLine = lines.find(line => 
      !line.match(/^[█░▓▒\-═╗╝╚╔ ]+$/) && 
      line.length > 5 && 
      line.length < 50
    );
    
    if (meaningfulLine) {
      return `🎨 ${meaningfulLine}`;
    }
    return '🎨 ASCII art content';
  }
  
  // Return truncated text for normal content
  return cleanText.substring(0, maxLength) + (cleanText.length > maxLength ? '...' : '');
}

/**
 * Server-side safe version for Node.js environments
 * Uses a simple but more robust regex approach when DOM is not available
 */
export function createTextPreviewServer(htmlContent: string, maxLength: number = 150): string {
  if (!htmlContent || htmlContent.trim() === '') {
    return 'No preview available';
  }
  
  // Check for media-only content patterns
  const videoPattern = /<video[^>]*>.*?<\/video>/gi;
  const imagePattern = /<img[^>]*\/?>/gi;
  const audioPattern = /<audio[^>]*>.*?<\/audio>/gi;
  const galleryPattern = /data-media-gallery/gi;
  const iframePattern = /<iframe[^>]*>.*?<\/iframe>/gi;
  
  const videos = htmlContent.match(videoPattern) || [];
  const images = htmlContent.match(imagePattern) || [];
  const audios = htmlContent.match(audioPattern) || [];
  const iframes = htmlContent.match(iframePattern) || [];
  const hasGallery = galleryPattern.test(htmlContent);
  
  // Remove all HTML tags for text extraction
  const textContent = htmlContent
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
    .replace(/<style[^>]*>.*?<\/style>/gi, '') // Remove styles
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Decode common entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // For empty or very short content after cleanup, check for media elements
  if (textContent === '' || textContent.length < 10) {
    if (hasGallery) {
      return '📸 Media gallery';
    }
    if (videos.length > 0) {
      return `📹 Video content (${videos.length} video${videos.length !== 1 ? 's' : ''})`;
    }
    if (images.length > 0) {
      return `🖼️ Image content (${images.length} image${images.length !== 1 ? 's' : ''})`;
    }
    if (audios.length > 0) {
      return `🎵 Audio content (${audios.length} audio${audios.length !== 1 ? 's' : ''})`;
    }
    
    // Check for embedded content like YouTube iframes
    if (iframes.length > 0) {
      const youtubeIframe = iframes.find(iframe => iframe.includes('youtube.com'));
      if (youtubeIframe) {
        return '🎥 YouTube video content';
      }
      return `🌐 Embedded content (${iframes.length} embed${iframes.length !== 1 ? 's' : ''})`;
    }
    
    // Check for special content types
    const originalLower = htmlContent.toLowerCase();
    if (originalLower.includes('live') && originalLower.includes('chat')) {
      return '💬 Live chat feature';
    }
    
    return 'Interactive content';
  }
  
  // For ASCII art or special formatted content, provide a more descriptive preview
  if (textContent.includes('██') || textContent.includes('░░') || textContent.includes('▓▒')) {
    // Try to extract a meaningful title or description from ASCII content
    const lines = textContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const meaningfulLine = lines.find(line => 
      !line.match(/^[█░▓▒\-═╗╝╚╔ ]+$/) && 
      line.length > 5 && 
      line.length < 50
    );
    
    if (meaningfulLine) {
      return `🎨 ${meaningfulLine}`;
    }
    return '🎨 ASCII art content';
  }
  
  return textContent.substring(0, maxLength) + (textContent.length > maxLength ? '...' : '');
}
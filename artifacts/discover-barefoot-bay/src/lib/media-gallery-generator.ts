/**
 * Media Gallery Generator
 * 
 * Generates interactive HTML galleries with navigation controls and popup functionality.
 * Uses self-contained JavaScript to avoid external script dependencies.
 */

export interface MediaItem {
  url: string;
  mediaType: 'image' | 'video' | 'audio';
  altText?: string;
}

export function generateMediaGallery(items: MediaItem[]): string {
  if (!items || items.length === 0) {
    return '<p>No media items to display</p>';
  }

  const galleryId = `gallery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // If only one item, show it as a single image/video
  if (items.length === 1) {
    const item = items[0];
    if (item.mediaType === 'video') {
      return `<div class="single-media" style="text-align: center; margin: 10px 0;">
        <video src="${item.url}" controls style="max-width: 100%; height: auto;"></video>
        <div style="font-size: 14px; color: #666; margin-top: 5px;">Single ${item.mediaType}</div>
      </div>`;
    } else if (item.mediaType === 'audio') {
      return `<div class="single-media" style="text-align: center; margin: 10px 0;">
        <audio src="${item.url}" controls style="width: 100%; max-width: 400px;"></audio>
        <div style="font-size: 14px; color: #666; margin-top: 5px;">Single ${item.mediaType}</div>
      </div>`;
    } else {
      return `<div class="single-media" style="text-align: center; margin: 10px 0;">
        <img src="${item.url}" alt="${item.altText || 'Single image'}" style="max-width: 100%; height: auto; cursor: pointer;" />
        <div style="font-size: 14px; color: #666; margin-top: 5px;">Single ${item.mediaType}</div>
      </div>`;
    }
  }

  // Multiple items - create carousel gallery with self-contained JavaScript
  let galleryHtml = `<div class="media-gallery" style="margin: 15px 0;">
  <div class="gallery-container" id="${galleryId}" style="position: relative; width: 100%; height: 300px; background: #f5f5f5; border-radius: 8px; overflow: hidden;">`;

  // Add all slides (ensure proper positioning for carousel)
  items.forEach((item, index) => {
    const isVisible = index === 0 ? 'block' : 'none';
    const itemHtml = item.mediaType === 'video' 
      ? `<video src="${item.url}" controls style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;"></video>`
      : item.mediaType === 'audio'
      ? `<audio src="${item.url}" controls style="width: 100%; height: 60px; margin: auto; display: block; margin-top: 120px;"></audio>`
      : `<img src="${item.url}" alt="${item.altText || `Image ${index + 1}`}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" />`;
    
    galleryHtml += `<div class="gallery-slide" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: ${isVisible}; z-index: ${index === 0 ? 2 : 1};" data-index="${index}">${itemHtml}</div>`;
  });
  
  // Add navigation controls if more than one item
  if (items.length > 1) {
    galleryHtml += `
    <div class="gallery-nav" style="position: absolute; top: 50%; transform: translateY(-50%); width: 100%; display: flex; justify-content: space-between; pointer-events: none; padding: 0 10px; box-sizing: border-box;">
      <button id="${galleryId}-prev" style="pointer-events: auto; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center;">‹</button>
      <button id="${galleryId}-next" style="pointer-events: auto; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center;">›</button>
    </div>`;
  }
  
  galleryHtml += `
  </div>
  <div class="gallery-info" style="text-align: center; margin-top: 8px; font-size: 14px; color: #666;">
    <span id="${galleryId}-counter">1 / ${items.length}</span> - Gallery (${items.length} items)
  </div>
</div>

<script>
(function() {
  // Self-contained gallery logic
  const galleryId = '${galleryId}';
  const items = ${JSON.stringify(items)};
  let currentIndex = 0;
  
  function updateGallery() {
    const slides = document.querySelectorAll('#' + galleryId + ' .gallery-slide');
    const counter = document.getElementById(galleryId + '-counter');
    
    slides.forEach((slide, index) => {
      slide.style.display = index === currentIndex ? 'block' : 'none';
    });
    
    if (counter) {
      counter.textContent = (currentIndex + 1) + ' / ' + items.length;
    }
  }
  
  function navigate(direction) {
    currentIndex += direction;
    if (currentIndex >= items.length) {
      currentIndex = 0;
    } else if (currentIndex < 0) {
      currentIndex = items.length - 1;
    }
    updateGallery();
  }
  
  function openPopup(index) {
    currentIndex = index;
    
    const overlay = document.createElement('div');
    overlay.id = 'gallery-popup-' + galleryId;
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.9); z-index: 10000; display: flex; align-items: center; justify-content: center;';
    
    const container = document.createElement('div');
    container.style.cssText = 'position: relative; max-width: 90vw; max-height: 90vh; display: flex; align-items: center; justify-content: center;';
    
    const mediaContainer = document.createElement('div');
    mediaContainer.style.cssText = 'position: relative; max-width: 100%; max-height: 100%;';
    
    function updatePopupMedia() {
      const currentItem = items[currentIndex];
      let mediaElement;
      
      if (currentItem.mediaType === 'video') {
        mediaElement = document.createElement('video');
        mediaElement.controls = true;
        mediaElement.style.cssText = 'max-width: 100%; max-height: 90vh; object-fit: contain;';
        mediaElement.src = currentItem.url;
      } else {
        mediaElement = document.createElement('img');
        mediaElement.style.cssText = 'max-width: 100%; max-height: 90vh; object-fit: contain;';
        mediaElement.src = currentItem.url;
        mediaElement.alt = currentItem.altText || '';
      }
      
      mediaContainer.innerHTML = '';
      mediaContainer.appendChild(mediaElement);
      
      if (popupCounter) {
        popupCounter.textContent = (currentIndex + 1) + ' / ' + items.length;
      }
    }
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = 'position: absolute; top: -40px; right: 0; background: none; border: none; color: white; font-size: 30px; cursor: pointer; z-index: 10001;';
    closeBtn.onclick = () => {
      const popup = document.getElementById('gallery-popup-' + galleryId);
      if (popup) document.body.removeChild(popup);
    };
    
    const popupCounter = document.createElement('div');
    popupCounter.style.cssText = 'position: absolute; bottom: -40px; left: 50%; transform: translateX(-50%); color: white; font-size: 16px;';
    
    if (items.length > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.innerHTML = '‹';
      prevBtn.style.cssText = 'position: absolute; left: -60px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 50px; height: 50px; cursor: pointer; font-size: 24px;';
      prevBtn.onclick = () => {
        currentIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        updatePopupMedia();
      };
      
      const nextBtn = document.createElement('button');
      nextBtn.innerHTML = '›';
      nextBtn.style.cssText = 'position: absolute; right: -60px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 50px; height: 50px; cursor: pointer; font-size: 24px;';
      nextBtn.onclick = () => {
        currentIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        updatePopupMedia();
      };
      
      container.appendChild(prevBtn);
      container.appendChild(nextBtn);
    }
    
    container.appendChild(mediaContainer);
    container.appendChild(closeBtn);
    container.appendChild(popupCounter);
    overlay.appendChild(container);
    
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        const popup = document.getElementById('gallery-popup-' + galleryId);
        if (popup) document.body.removeChild(popup);
      }
    };
    
    updatePopupMedia();
    document.body.appendChild(overlay);
  }
  
  // Wait for DOM ready then attach event listeners
  setTimeout(() => {
    const prevBtn = document.getElementById(galleryId + '-prev');
    const nextBtn = document.getElementById(galleryId + '-next');
    
    if (prevBtn) prevBtn.onclick = () => navigate(-1);
    if (nextBtn) nextBtn.onclick = () => navigate(1);
    
    // Add click handlers to images for popup
    const slides = document.querySelectorAll('#' + galleryId + ' .gallery-slide img, #' + galleryId + ' .gallery-slide video');
    slides.forEach((element, index) => {
      element.onclick = () => openPopup(index);
      element.style.cursor = 'pointer';
    });
  }, 100);
})();
</script>`;
  
  return galleryHtml;
}
export interface MediaGalleryItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  title?: string;
  description?: string;
  thumbnail?: string;
}

export function generateGalleryHTML(items: MediaGalleryItem[]): string {
  if (!items || items.length === 0) {
    return '<div class="gallery-empty">No media items available</div>';
  }

  const galleryItems = items.map(item => {
    const mediaElement = item.type === 'video' 
      ? `<video src="${item.url}" controls class="gallery-media"></video>`
      : `<img src="${item.url}" alt="${item.title || 'Gallery image'}" class="gallery-media">`;

    return `
      <div class="gallery-item" data-id="${item.id}">
        ${mediaElement}
        ${item.title ? `<div class="gallery-title">${item.title}</div>` : ''}
        ${item.description ? `<div class="gallery-description">${item.description}</div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="media-gallery">
      ${galleryItems}
    </div>
  `;
}

export function createGalleryItem(
  id: string,
  url: string,
  type: 'image' | 'video',
  options?: { title?: string; description?: string; thumbnail?: string }
): MediaGalleryItem {
  return {
    id,
    url,
    type,
    ...options
  };
}

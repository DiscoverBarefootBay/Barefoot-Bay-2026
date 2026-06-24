/**
 * Global Gallery Utilities for Interactive Media Galleries
 * This file provides navigation and popup functionality for galleries created in the WYSIWYG editor
 */

// Initialize global gallery data storage
window.galleryData = window.galleryData || {};

/**
 * Navigate through gallery slides
 * @param {string} galleryId - Unique gallery identifier
 * @param {number} direction - Direction to navigate (-1 for previous, 1 for next)
 */
function navigateGallery(galleryId, direction) {
  const gallery = window.galleryData[galleryId];
  if (!gallery || !gallery.items) return;
  
  const slides = document.querySelectorAll('#' + galleryId + ' .gallery-slide');
  const counter = document.getElementById(galleryId + '-counter');
  
  if (slides.length === 0) return;
  
  // Hide current slide
  slides[gallery.currentIndex].style.display = 'none';
  
  // Calculate new index with wraparound
  gallery.currentIndex += direction;
  if (gallery.currentIndex >= gallery.items.length) {
    gallery.currentIndex = 0;
  } else if (gallery.currentIndex < 0) {
    gallery.currentIndex = gallery.items.length - 1;
  }
  
  // Show new slide
  slides[gallery.currentIndex].style.display = 'block';
  
  // Update counter
  if (counter) {
    counter.textContent = (gallery.currentIndex + 1) + ' / ' + gallery.items.length;
  }
}

/**
 * Open gallery popup with full-size view and navigation
 * @param {string} galleryId - Unique gallery identifier
 * @param {number} index - Index of the image to start with
 */
function openGalleryPopup(galleryId, index) {
  const galleryData = window.galleryData[galleryId];
  if (!galleryData || !galleryData.items) return;
  
  const items = galleryData.items;
  let currentPopupIndex = index;
  
  function createPopup() {
    // Remove any existing popup
    const existingPopup = document.getElementById('gallery-popup-' + galleryId);
    if (existingPopup) {
      document.body.removeChild(existingPopup);
    }
    
    const overlay = document.createElement('div');
    overlay.id = 'gallery-popup-' + galleryId;
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.9);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
      position: relative;
      max-width: 90vw;
      max-height: 90vh;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const mediaContainer = document.createElement('div');
    mediaContainer.id = 'popup-media-' + galleryId;
    mediaContainer.style.cssText = `
      position: relative;
      max-width: 100%;
      max-height: 100%;
    `;
    
    function updateMedia() {
      const currentItem = items[currentPopupIndex];
      let mediaElement;
      
      if (currentItem.mediaType === 'video') {
        mediaElement = document.createElement('video');
        mediaElement.controls = true;
        mediaElement.style.cssText = `
          max-width: 100%;
          max-height: 90vh;
          object-fit: contain;
        `;
        mediaElement.src = currentItem.url;
      } else {
        mediaElement = document.createElement('img');
        mediaElement.style.cssText = `
          max-width: 100%;
          max-height: 90vh;
          object-fit: contain;
        `;
        mediaElement.src = currentItem.url;
        mediaElement.alt = currentItem.altText || '';
      }
      
      mediaContainer.innerHTML = '';
      mediaContainer.appendChild(mediaElement);
      
      // Update counter
      if (counter) {
        counter.textContent = (currentPopupIndex + 1) + ' / ' + items.length;
      }
    }
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: -40px;
      right: 0;
      background: none;
      border: none;
      color: white;
      font-size: 30px;
      cursor: pointer;
      z-index: 10001;
    `;
    closeBtn.onclick = () => {
      const popup = document.getElementById('gallery-popup-' + galleryId);
      if (popup) document.body.removeChild(popup);
    };
    
    // Counter
    const counter = document.createElement('div');
    counter.style.cssText = `
      position: absolute;
      bottom: -40px;
      left: 50%;
      transform: translateX(-50%);
      color: white;
      font-size: 16px;
    `;
    
    // Navigation buttons for popup
    if (items.length > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.innerHTML = '‹';
      prevBtn.style.cssText = `
        position: absolute;
        left: -60px;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0,0,0,0.7);
        color: white;
        border: none;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        cursor: pointer;
        font-size: 24px;
      `;
      prevBtn.onclick = () => {
        currentPopupIndex = currentPopupIndex > 0 ? currentPopupIndex - 1 : items.length - 1;
        updateMedia();
      };
      
      const nextBtn = document.createElement('button');
      nextBtn.innerHTML = '›';
      nextBtn.style.cssText = `
        position: absolute;
        right: -60px;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0,0,0,0.7);
        color: white;
        border: none;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        cursor: pointer;
        font-size: 24px;
      `;
      nextBtn.onclick = () => {
        currentPopupIndex = currentPopupIndex < items.length - 1 ? currentPopupIndex + 1 : 0;
        updateMedia();
      };
      
      container.appendChild(prevBtn);
      container.appendChild(nextBtn);
    }
    
    container.appendChild(mediaContainer);
    container.appendChild(closeBtn);
    container.appendChild(counter);
    overlay.appendChild(container);
    
    // Close on background click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        const popup = document.getElementById('gallery-popup-' + galleryId);
        if (popup) document.body.removeChild(popup);
      }
    };
    
    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        const popup = document.getElementById('gallery-popup-' + galleryId);
        if (popup) {
          document.body.removeChild(popup);
          document.removeEventListener('keydown', escapeHandler);
        }
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
    updateMedia();
    document.body.appendChild(overlay);
  }
  
  createPopup();
}

// Make functions globally available
window.navigateGallery = navigateGallery;
window.openGalleryPopup = openGalleryPopup;
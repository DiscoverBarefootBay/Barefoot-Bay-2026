// Clear banner slides cache and force reload with new content
localStorage.removeItem('communityBannerSlides');
console.log('Banner slides cache cleared - page will reload with fresh content');
window.location.reload();
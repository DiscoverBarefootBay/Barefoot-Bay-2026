/**
 * TinyMCE Integration for Object Storage
 * 
 * This file configures TinyMCE to use context-aware media upload endpoints
 * that connect to the appropriate Replit Object Storage buckets
 */

// Initialize the TinyMCE configuration with our context-aware image upload handler
export function initTinyMCEWithObjectStorage(selector, options = {}, context = {}) {
  // Default upload endpoint
  let uploadEndpoint = '/api/forum/tinymce-upload';
  
  // Determine endpoint based on context
  if (context.section === 'vendors') {
    console.log('Using vendor media upload endpoint for TinyMCE editor');
    uploadEndpoint = '/api/vendor/tinymce-upload';
  } else if (context.section) {
    console.log(`Using ${context.section} media upload endpoint for TinyMCE editor`);
    uploadEndpoint = `/api/${context.section}/tinymce-upload`;
  } else {
    console.log('Using default forum media upload endpoint for TinyMCE editor');
  }
  
  // Default configuration
  const defaultConfig = {
    selector,
    height: 500,
    menubar: false,
    directionality: 'ltr',
    content_css_cors: true,
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
      'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
      'insertdatetime', 'media', 'table', 'help', 'wordcount'
    ],
    toolbar: 'undo redo | blocks | ' +
      'bold italic forecolor | alignleft aligncenter ' +
      'alignright alignjustify | bullist numlist outdent indent | ' +
      'removeformat | image | help',
    content_style: 'body, p, h1, h2, h3, h4, h5, h6, div { direction: ltr !important; text-align: left !important; font-family:Helvetica,Arial,sans-serif; font-size:14px }',
    iframe_attrs: {
      dir: 'ltr',
      style: 'direction: ltr; unicode-bidi: embed;'
    },
    setup: function(editor) {
      editor.on('keydown', function(e) {
        // Prevent cursor jumping when pressing space at the end of paragraphs
        if (e.keyCode === 32 && editor.selection.isAtEnd()) {
          e.preventDefault();
          editor.execCommand('mceInsertContent', false, '&nbsp;');
        }
      });
    },
    
    // Configure context-aware image upload handler
    images_upload_handler: function (blobInfo, progress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        
        console.log(`TinyMCE uploading to endpoint: ${uploadEndpoint}`);
        xhr.open('POST', uploadEndpoint);
        
        xhr.upload.onprogress = (e) => {
          progress(e.loaded / e.total * 100);
        };
        
        xhr.onload = function() {
          if (xhr.status === 403) {
            reject({ message: 'HTTP Error: ' + xhr.status, remove: true });
            return;
          }
          
          if (xhr.status < 200 || xhr.status >= 300) {
            reject('HTTP Error: ' + xhr.status);
            return;
          }
          
          let json;
          try {
            json = JSON.parse(xhr.responseText);
          } catch (e) {
            reject('Invalid JSON response: ' + xhr.responseText);
            return;
          }
          
          if (!json || typeof json.location != 'string') {
            reject('Invalid server response');
            return;
          }
          
          // Resolve with the URL from the server response
          resolve(json.location);
        };
        
        xhr.onerror = function () {
          reject('Image upload failed');
        };
        
        const formData = new FormData();
        formData.append('file', blobInfo.blob(), blobInfo.filename());
        
        xhr.send(formData);
      });
    }
  };
  
  // Merge with user options
  const mergedConfig = { ...defaultConfig, ...options };
  
  // Initialize TinyMCE if it's already loaded
  if (window.tinymce) {
    window.tinymce.init(mergedConfig);
  } else {
    // Set up a callback for when TinyMCE is loaded
    window.tinymceObjectStorageConfig = mergedConfig;
    console.log('TinyMCE not loaded yet, storing config for later initialization');
  }
  
  return mergedConfig;
}
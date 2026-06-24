// Basic toast implementation for messaging feature
// This is a simplified version of toast component that provides just what we need

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

export function toast(options: ToastOptions) {
  // For now, just log to console since we're focusing on the messaging UI
  console.log('[Toast]', options);
  
  // Could implement a more sophisticated toast system in the future
  // For now, just use browser alert for destructive messages
  if (options.variant === 'destructive') {
    alert(`${options.title}: ${options.description}`);
  }
}
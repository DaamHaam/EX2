const SW_PATH = '/sw.js';

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(SW_PATH)
        .then((registration) => {
          if (registration.waiting) {
            notifyUpdate(registration.waiting);
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                notifyUpdate(newWorker);
              }
            });
          });
        })
        .catch((error) => {
          console.error('Service worker registration failed', error);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });
  }
}

function notifyUpdate(worker) {
  const event = new CustomEvent('sw-update', {
    detail: {
      refresh() {
        worker.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  });
  window.dispatchEvent(event);
}

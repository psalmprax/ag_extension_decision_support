import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    console.log('Ag-Extension Content Script Active');

    // Create UI Container
    const ui = await createShadowRootUi(ctx, {
      name: 'ag-extension-toolbar',
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      onMount: (container) => {
        const wrapper = document.createElement('div');
        wrapper.id = 'ag-toolbar-root';
        wrapper.className = 'fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end';

        // Photo Capture Button
        const photoBtn = document.createElement('button');
        photoBtn.innerHTML = `
          <div style="
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            box-shadow: 0 8px 20px -5px rgba(245, 158, 11, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.2);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          " onmouseover="this.style.transform='scale(1.05) translateY(-2px)'" onmouseout="this.style.transform='scale(1) translateY(0)'">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 1v6M12 17v6M1 12h6M17 12h6"/></svg>
          </div>
        `;

        photoBtn.onclick = async () => {
          try {
            // Request camera permission and capture photo
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'environment' } // Use back camera on mobile
            });

            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();

            // Create canvas for capture
            const canvas = document.createElement('canvas');
            const canvasCtx = canvas.getContext('2d');

            video.addEventListener('loadedmetadata', () => {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;

              // Capture after a short delay to let camera focus
              setTimeout(() => {
                if (canvasCtx) {
                  canvasCtx.drawImage(video, 0, 0);
                  const imageData = canvas.toDataURL('image/jpeg', 0.8);

                  // Stop camera stream
                  stream.getTracks().forEach(track => track.stop());

                  // Send to sidepanel for analysis
                  const browserAPI = (window as any).browser || (window as any).chrome;
                  if (browserAPI && browserAPI.runtime) {
                    browserAPI.runtime.sendMessage({
                      action: 'photo_captured',
                      imageData: imageData
                    });

                    // Open sidepanel
                    browserAPI.runtime.sendMessage({ action: 'open_sidepanel' });
                  }
                }
              }, 1000);
            });
          } catch (error) {
            console.error('Camera access failed:', error);
            // Fallback - let user know camera access is needed
            alert('Camera access is required for photo capture. Please enable camera permissions and try again.');
          }
        };

        // Simple Floating Action Button (FAB)
        const fab = document.createElement('button');
        fab.innerHTML = `
          <div style="
            width: 56px;
            height: 56px;
            border-radius: 16px;
            background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
            box-shadow: 0 10px 25px -5px rgba(13, 148, 136, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.2);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          " onmouseover="this.style.transform='scale(1.05) translateY(-2px)'" onmouseout="this.style.transform='scale(1) translateY(0)'">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
        `;

        fab.onclick = () => {
          const browserAPI = (window as any).browser || (window as any).chrome;
          if (browserAPI && browserAPI.runtime) {
            browserAPI.runtime.sendMessage({ action: 'open_sidepanel' });
          }
        };

        // GPS Location Button
        const gpsBtn = document.createElement('button');
        gpsBtn.innerHTML = `
          <div style="
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            box-shadow: 0 8px 20px -5px rgba(16, 185, 129, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.2);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          " onmouseover="this.style.transform='scale(1.05) translateY(-2px)'" onmouseout="this.style.transform='scale(1) translateY(0)'">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 1v6M12 17v6M1 12h6M17 12h6"/></svg>
          </div>
        `;

        gpsBtn.onclick = async () => {
          try {
            if (!navigator.geolocation) {
              alert('Geolocation is not supported by this browser.');
              return;
            }

            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
              });
            });

            const { latitude, longitude, accuracy } = position.coords;
            const timestamp = new Date(position.timestamp).toISOString();

            // Send location data to sidepanel
            const browserAPI = (window as any).browser || (window as any).chrome;
            if (browserAPI && browserAPI.runtime) {
              browserAPI.runtime.sendMessage({
                action: 'location_captured',
                location: {
                  latitude,
                  longitude,
                  accuracy,
                  timestamp
                }
              });

              // Open sidepanel
              browserAPI.runtime.sendMessage({ action: 'open_sidepanel' });
            }
          } catch (error) {
            console.error('Location access failed:', error);
            alert('Location access failed. Please enable location permissions and try again.');
          }
        };

        wrapper.appendChild(gpsBtn);
        wrapper.appendChild(photoBtn);
        wrapper.appendChild(fab);
        container.appendChild(wrapper);
      },
    });

    ui.mount();
  },
});

// Helper for WXT UI injection (Simplified for boilerplate)
async function createShadowRootUi(ctx: any, options: any) {
  const container = document.createElement('div');
  container.id = options.name;
  const shadow = container.attachShadow({ mode: 'open' });

  return {
    mount: () => {
      document.body.appendChild(container);
      options.onMount(shadow);
    },
    remove: () => {
      container.remove();
    }
  };
}

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx: any) {
    console.log('Ag-Extension Content Script Active');

    // Create UI Container
    const ui = await createShadowRootUi(ctx, {
      name: 'ag-extension-toolbar',
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      onMount: (container: any) => {
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

        // Sync Button
        const syncBtn = document.createElement('button');
        syncBtn.innerHTML = `
          <div style="
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            box-shadow: 0 8px 20px -5px rgba(59, 130, 246, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.2);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          " onmouseover="this.style.transform='scale(1.05) translateY(-2px)'" onmouseout="this.style.transform='scale(1) translateY(0)'">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          </div>
        `;

        syncBtn.onclick = async () => {
          try {
            const browserAPI = (window as any).browser || (window as any).chrome;
            if (browserAPI && browserAPI.runtime) {
              // Show loading state
              const originalIcon = syncBtn.querySelector('div');
              if (originalIcon) {
                originalIcon.innerHTML = `
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                `;
              }

              await browserAPI.runtime.sendMessage({ action: 'sync_now' });

              // Show success briefly
              if (originalIcon) {
                originalIcon.innerHTML = `
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                `;
              }

              setTimeout(() => {
                if (originalIcon) {
                  originalIcon.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                  `;
                }
              }, 2000);
            }
          } catch (error) {
            console.error('Sync failed:', error);
            // Show error state briefly
            const iconDiv = syncBtn.querySelector('div');
            if (iconDiv) {
              iconDiv.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M15 9l-6 6"/>
                  <path d="M9 9l6 6"/>
                </svg>
              `;
              setTimeout(() => {
                iconDiv.innerHTML = `
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                `;
              }, 2000);
            }
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

            // Show loading state
            const originalIcon = gpsBtn.querySelector('div');
            if (originalIcon) {
              originalIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              `;
            }

            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 300000 // 5 minutes
              });
            });

            const { latitude, longitude, accuracy } = position.coords;
            const timestamp = new Date(position.timestamp).toISOString();

            // Validate location accuracy
            let accuracyStatus = 'good';
            if (accuracy > 100) accuracyStatus = 'acceptable';
            if (accuracy > 1000) accuracyStatus = 'poor';

            // Send location data to sidepanel with validation
            const browserAPI = (window as any).browser || (window as any).chrome;
            if (browserAPI && browserAPI.runtime) {
              browserAPI.runtime.sendMessage({
                action: 'location_captured',
                location: {
                  latitude,
                  longitude,
                  accuracy,
                  accuracyStatus,
                  timestamp
                }
              });

              // Open sidepanel
              browserAPI.runtime.sendMessage({ action: 'open_sidepanel' });
            }
          } catch (error: any) {
            console.error('Location access failed:', error);

            let errorMessage = 'Location access failed.';
            if (error.code === 1) {
              errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
            } else if (error.code === 2) {
              errorMessage = 'Location unavailable. Please check your GPS/network connection.';
            } else if (error.code === 3) {
              errorMessage = 'Location request timed out. Please try again.';
            }

            alert(errorMessage);
          } finally {
            // Reset button icon
            const iconDiv = gpsBtn.querySelector('div');
            if (iconDiv) {
              iconDiv.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 1v6M12 17v6M1 12h6M17 12h6"/></svg>
              `;
            }
          }
        };

        // Log Visit Button
        const logVisitBtn = document.createElement('button');
        logVisitBtn.innerHTML = `
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
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        `;

        logVisitBtn.onclick = () => {
          const browserAPI = (window as any).browser || (window as any).chrome;
          if (browserAPI && browserAPI.runtime) {
            browserAPI.runtime.sendMessage({ action: 'open_sidepanel', tab: 'log' });
          }
        };

        wrapper.appendChild(syncBtn);
        wrapper.appendChild(gpsBtn);
        wrapper.appendChild(photoBtn);
        wrapper.appendChild(logVisitBtn);
        wrapper.appendChild(fab);
        container.appendChild(wrapper);
      },
    });

    // Add message listener for page context requests
    const browserAPI = (window as any).browser || (window as any).chrome;
    if (browserAPI && browserAPI.runtime) {
      browserAPI.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
        if (message.action === 'get_page_context') {
          // Extract page context
          const context = {
            title: document.title,
            url: window.location.href,
            selectedText: window.getSelection()?.toString() || '',
            metaDescription: (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content || '',
            // Extract main content text (simplified)
            mainContent: extractMainContent()
          };
          sendResponse(context);
          return true; // Keep channel open for async response
        }
      });
    }

    ui.mount();
  },
});

// Helper function to extract main content from the page
function extractMainContent(): string {
  // Try to find main content areas
  const selectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post', '.entry'];
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent) {
      return element.textContent.trim().substring(0, 2000); // Limit to 2000 chars
    }
  }

  // Fallback: extract from body, excluding scripts and styles
  const bodyText = document.body?.textContent || '';
  return bodyText.replace(/\s+/g, ' ').trim().substring(0, 2000);
}

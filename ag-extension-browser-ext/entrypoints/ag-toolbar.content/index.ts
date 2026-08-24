import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { browser } from 'wxt/browser';

/** Safely set HTML content — escapes any non-SVG text to prevent XSS */
const safeSetHTML = (el: HTMLElement, html: string) => {
  // For static SVG/icon templates with no user input, use a sandboxed approach
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  el.appendChild(template.content);
};

export default defineContentScript({
  matches: ['<all_urls>'],
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
        safeSetHTML(photoBtn, `
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
        `);

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
                  browser.runtime.sendMessage({
                    action: 'photo_captured',
                    imageData: imageData
                  });

                  // Open sidepanel
                  browser.runtime.sendMessage({ action: 'open_sidepanel' });
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
        safeSetHTML(fab, `
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
        `);

        fab.onclick = () => {
          browser.runtime.sendMessage({ action: 'open_sidepanel' });
        };

        // Sync Button
        const syncBtn = document.createElement('button');
        safeSetHTML(syncBtn, `
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
        `);

        syncBtn.onclick = async () => {
          try {
            // Show loading state
            const originalIcon = syncBtn.querySelector('div');
            if (originalIcon) {
              safeSetHTML(originalIcon, `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              `);
            }

            await browser.runtime.sendMessage({ action: 'sync_now' });

              // Show success briefly
              if (originalIcon) {
                safeSetHTML(originalIcon, `
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                `);
              }

              setTimeout(() => {
                if (originalIcon) {
                  safeSetHTML(originalIcon, `
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                  `);
                }
              }, 2000);
          } catch (error) {
            console.error('Sync failed:', error);
            // Show error state briefly
            const iconDiv = syncBtn.querySelector('div');
            if (iconDiv) {
              safeSetHTML(iconDiv, `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M15 9l-6 6"/>
                  <path d="M9 9l6 6"/>
                </svg>
              `);
              setTimeout(() => {
                safeSetHTML(iconDiv, `
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                `);
              }, 2000);
            }
          }
        };

        // GPS Location Button
        const gpsBtn = document.createElement('button');
        safeSetHTML(gpsBtn, `
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
        `);

        gpsBtn.onclick = async () => {
          try {
            if (!navigator.geolocation) {
              alert('Geolocation is not supported by this browser.');
              return;
            }

            // Show loading state
            const originalIcon = gpsBtn.querySelector('div');
            if (originalIcon) {
              safeSetHTML(originalIcon, `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              `);
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
            browser.runtime.sendMessage({
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
            browser.runtime.sendMessage({ action: 'open_sidepanel' });
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
              safeSetHTML(iconDiv, `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 1v6M12 17v6M1 12h6M17 12h6"/></svg>
              `);
            }
          }
        };

        // Log Visit Button
        const logVisitBtn = document.createElement('button');
        safeSetHTML(logVisitBtn, `
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
        `);

        logVisitBtn.onclick = () => {
          browser.runtime.sendMessage({ action: 'open_sidepanel', tab: 'log' });
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
    browser.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
        if (message.action === 'get_page_context') {
          const context = {
            title: document.title,
            url: window.location.href,
            selectedText: window.getSelection()?.toString() || '',
            metaDescription: (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content || '',
            mainContent: extractMainContent(),
            structuredData: extractStructuredData(),
            forms: extractForms(),
            tables: extractTables(),
            lists: extractLists(),
            agriculturalData: extractAgriculturalData(),
          };
          sendResponse(context);
          return true;
        }
        if (message.action === 'extract_structured') {
          sendResponse(extractStructuredData());
          return true;
        }
        if (message.action === 'extract_forms') {
          sendResponse(extractForms());
          return true;
        }
        if (message.action === 'extract_tables') {
          sendResponse(extractTables());
          return true;
        }
        if (message.action === 'extract_agricultural_data') {
          sendResponse(extractAgriculturalData());
          return true;
        }
      });

    // Selection Overlay Bubble Logic
    let bubble: HTMLDivElement | null = null;

    const createSelectionBubble = () => {
      if (bubble) return;
      bubble = document.createElement('div');
      bubble.id = 'ag-selection-bubble';
      bubble.style.cssText = `
        position: fixed;
        z-index: 10000;
        background: #0d9488;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        padding: 4px 8px;
        display: none;
        cursor: pointer;
        color: white;
        font-family: sans-serif;
        font-weight: bold;
        font-size: 11px;
        align-items: center;
        gap: 6px;
        border: 1px solid rgba(255,255,255,0.1);
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
      `;
      safeSetHTML(bubble, `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        <span>ANALYZE WITH AI</span>
      `);

      bubble.onmousedown = (e) => {
        e.preventDefault(); // Prevent losing selection
        e.stopPropagation();
      };

      bubble.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const selectedText = window.getSelection()?.toString() || '';
        if (selectedText.length > 0) {
          browser.runtime.sendMessage({ action: 'open_sidepanel' });
          setTimeout(() => {
            browser.runtime.sendMessage({
              action: 'analyze_selection',
              text: selectedText
            });
          }, 300);
        }
        hideBubble();
      };

      document.body.appendChild(bubble);
    };

    const showBubble = (rect: DOMRect) => {
      if (!bubble) createSelectionBubble();
      if (bubble) {
        bubble.style.display = 'flex';
        bubble.style.top = `${rect.top - 40}px`;
        bubble.style.left = `${rect.left + rect.width / 2 - 60}px`;
        bubble.style.transform = 'scale(1)';
      }
    };

    const hideBubble = () => {
      if (bubble) {
        bubble.style.display = 'none';
        bubble.style.transform = 'scale(0.8)';
      }
    };

    document.addEventListener('mouseup', (e) => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length > 5 && selection) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0) {
          showBubble(rect);
        }
      } else if (bubble && !bubble.contains(e.target as Node)) {
        hideBubble();
      }
    });

    document.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + Shift + A
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
        const text = window.getSelection()?.toString().trim();
        if (text) {
          e.preventDefault();
          browser.runtime.sendMessage({ action: 'open_sidepanel' });
          setTimeout(() => {
            browser.runtime.sendMessage({
              action: 'analyze_selection',
              text: text
            });
          }, 300);
        }
      }
    });

    ui.mount();
  },
});

// Helper function to extract main content from the page
function extractMainContent(): string {
  const selectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post', '.entry'];
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent) {
      return element.textContent.trim().substring(0, 5000);
    }
  }
  const bodyText = document.body?.textContent || '';
  return bodyText.replace(/\s+/g, ' ').trim().substring(0, 5000);
}

function extractStructuredData(): { headings: Array<{ tag: string; text: string }>; links: Array<{ text: string; url: string }>; images: Array<{ alt: string; src: string }>; metadata: Record<string, string> } {
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    .map(h => ({ tag: h.tagName, text: h.textContent?.trim() || '' }))
    .filter(h => h.text.length > 0);

  const links = Array.from(document.querySelectorAll('a[href]'))
    .slice(0, 50)
    .map(a => ({ text: a.textContent?.trim() || '', url: a.getAttribute('href') || '' }))
    .filter(l => l.text.length > 0 || l.url.length > 0);

  const images = Array.from(document.querySelectorAll('img[src]'))
    .slice(0, 30)
    .map(img => ({ alt: img.getAttribute('alt') || '', src: img.getAttribute('src') || '' }));

  const metadata: Record<string, string> = {};
  document.querySelectorAll('meta[name], meta[property]').forEach(meta => {
    const name = meta.getAttribute('name') || meta.getAttribute('property') || '';
    const content = meta.getAttribute('content') || '';
    if (name && content) metadata[name] = content;
  });

  return { headings, links, images, metadata };
}

function extractForms(): Array<{ id: string; action: string; method: string; fields: Array<{ name: string; type: string; label: string; required: boolean }> }> {
  return Array.from(document.querySelectorAll('form')).map((form, idx) => ({
    id: form.id || `form_${idx}`,
    action: form.getAttribute('action') || window.location.href,
    method: form.getAttribute('method') || 'get',
    fields: Array.from(form.querySelectorAll('input, select, textarea')).map(field => ({
      name: field.getAttribute('name') || field.getAttribute('id') || '',
      type: field.getAttribute('type') || field.tagName.toLowerCase(),
      label: getFieldLabel(field),
      required: field.hasAttribute('required'),
    })),
  }));
}

function extractTables(): Array<{ id: string; headers: string[]; rows: string[][]; rowCount: number }> {
  return Array.from(document.querySelectorAll('table')).map((table, idx) => {
    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim() || '');
    const rows = Array.from(table.querySelectorAll('tbody tr, tr')).map(row =>
      Array.from(row.querySelectorAll('td, th')).map(cell => cell.textContent?.trim() || '')
    );
    return {
      id: table.id || `table_${idx}`,
      headers,
      rows,
      rowCount: rows.length,
    };
  });
}

function extractLists(): Array<{ type: 'ordered' | 'unordered'; items: string[] }> {
  return Array.from(document.querySelectorAll('ul, ol')).map(list => ({
    type: list.tagName === 'OL' ? 'ordered' : 'unordered',
    items: Array.from(list.querySelectorAll('li')).map(li => li.textContent?.trim() || ''),
  }));
}

function extractAgriculturalData(): {
  cropNames: string[];
  prices: Array<{ crop: string; price: string; unit: string; location?: string }>;
  weatherData: { temperature?: string; condition?: string; location?: string };
  contactInfo: Array<{ name: string; phone?: string; email?: string; address?: string }>;
  dates: string[];
  locations: string[];
} {
  const text = document.body?.textContent || '';
  const cropPatterns = ['maize', 'wheat', 'rice', 'coffee', 'beans', 'sorghum', 'cassava', 'potatoes', 'tomatoes', 'cotton', 'tea', 'sugarcane', 'millet', 'groundnuts', 'sunflower'];
  const cropNames = cropPatterns.filter(crop => text.toLowerCase().includes(crop));

  const prices: Array<{ crop: string; price: string; unit: string; location?: string }> = [];
  const priceRegex = /(\w+)\s*[:\-]?\s*\$?(\d[\d,.]*)\s*(per|\/|for)?\s*(kg|ton|bag|bushel|tonne)?/gi;
  let match;
  while ((match = priceRegex.exec(text)) !== null) {
    prices.push({ crop: match[1], price: match[2], unit: match[4] || 'unit', location: undefined });
  }

  const weatherElements = document.querySelectorAll('[class*="weather"], [class*="temperature"], [class*="forecast"], [id*="weather"]');
  const weatherData: { temperature?: string; condition?: string; location?: string } = {};
  weatherElements.forEach(el => {
    const tempMatch = el.textContent?.match(/(-?\d+)\s*°?\s*[CF]/);
    if (tempMatch) weatherData.temperature = tempMatch[0];
  });

  const contactInfo: Array<{ name: string; phone?: string; email?: string; address?: string }> = [];
  const phoneRegex = /[\+]?[\d\s\-\(\)]{7,20}/g;
  const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
  const phones = text.match(phoneRegex) || [];
  const emails = text.match(emailRegex) || [];
  if (phones.length > 0 || emails.length > 0) {
    contactInfo.push({ name: 'Page Contact', phone: phones[0], email: emails[0] });
  }

  const dateRegex = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi;
  const dates = (text.match(dateRegex) || []).slice(0, 10);

  const locationRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,\s*[A-Z][a-z]+)*)\b/g;
  const locations = [...new Set((text.match(locationRegex) || []).filter(l => l.length > 3))].slice(0, 10);

  return { cropNames, prices, weatherData, contactInfo, dates, locations };
}

function getFieldLabel(field: Element): string {
  const id = field.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return label.textContent?.trim() || '';
  }
  const parentLabel = field.closest('label');
  if (parentLabel) return parentLabel.textContent?.trim() || '';
  const placeholder = field.getAttribute('placeholder');
  if (placeholder) return placeholder;
  const name = field.getAttribute('name');
  return name ? name.replace(/[_-]/g, ' ') : '';
}

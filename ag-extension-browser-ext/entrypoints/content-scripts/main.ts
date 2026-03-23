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
          chrome.runtime.sendMessage({ action: 'open_sidepanel' });
        };
        
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

// src/main.ts
import './style.css'; 
// 👇 ERROR WAS HERE: Ensure file is named "volca.ts" (lowercase v)
import { VolcaCore } from './volca'; 
import { ZCSSEngine } from './zcss';

// Importing the documentation/background simulation ZCSS
// We use raw import to get the file content as text
import indexZCSS from './index.zcss?raw'; 

async function initSite() {
    console.log("BOOTING VOLCA SITE...");
    
    // Setup Canvas
    const canvas = document.getElementById('volca-canvas') as HTMLCanvasElement;
    if (!canvas) {
        console.error("Canvas element #volca-canvas not found!");
        return;
    }
    
    // Initial Resize
    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();
    
    // Parse the Documentation Config
    console.log("Parsing ZCSS Rules...");
    try {
        const rules = ZCSSEngine.parse(indexZCSS);
        const bgConfig = rules.find(r => r.selector === '#doc-background');

        if (bgConfig) {
            console.log("Config found. Initializing GPU...");
            const engine = new VolcaCore(canvas);
            // Start the engine with the ZCSS params
            await engine.boot(bgConfig.params);
            
            // Remove loading screen if successful
            const loader = document.getElementById('loading-overlay');
            if (loader) loader.style.display = 'none';
        } else {
            console.error("ZCSS Error: #doc-background rule not found in index.zcss");
        }
    } catch (e) {
        console.error("Critical Engine Failure:", e);
    }
}

initSite();

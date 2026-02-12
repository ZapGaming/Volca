// src/main.ts
import './style.css'
import { VolcaCore } from './volca';
import { ZCSSEngine } from './zcss';

// 1. Load the Index ZCSS for the background visuals
// We use a raw import if your Vite config supports it, 
// OR just a fetch call if the file is in public or handled differently.
// For easiest implementation with current setup:
import indexZCSS from './index.zcss?raw'; 

async function initSite() {
    console.log("BOOTING VOLCA SITE...");
    
    // Setup Canvas
    const canvas = document.getElementById('volca-canvas') as HTMLCanvasElement;
    
    // Initial Resize
    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();
    
    // Parse the Documentation Config
    // This looks for '#doc-background' in the ZCSS file
    const rules = ZCSSEngine.parse(indexZCSS);
    const bgConfig = rules.find(r => r.selector === '#doc-background');

    if (bgConfig) {
        const engine = new VolcaCore(canvas);
        // Start the engine with the ZCSS params
        await engine.boot(bgConfig.params);
    } else {
        console.error("ZCSS: #doc-background rule not found.");
    }
}

initSite();

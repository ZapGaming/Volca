import './style.css'; 
import { VolcaCore } from './volca';
import { ZCSSEngine } from './zcss';

const canvas = document.getElementById('volca-canvas') as HTMLCanvasElement;
const display = document.getElementById('code-display');

// 1. Initialize GPU Engine
const engine = new VolcaCore(canvas);
engine.boot().then(() => {
    // 2. Set Default State via ZCSS
    applyZCSS(`
        #engine {
            physics-gravity: 0.0;
            physics-turbulence: 1.0;
            color-mode: fire;
            interaction-repel: true;
        }
    `);
});

// 3. Resize Logic
const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
};
window.addEventListener('resize', resize);
resize();

// 4. Handle Button Clicks (ZCSS Injection)
document.querySelectorAll('.zcss-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const rawCSS = (e.currentTarget as HTMLElement).getAttribute('data-zcss')!;
        applyZCSS(rawCSS);
    });
});

function applyZCSS(css: string) {
    // Show code on screen
    if(display) display.innerText = css;
    
    // Parse
    const rules = ZCSSEngine.parse(css);
    const config = rules.find(r => r.selector === '#engine');
    
    // Send to GPU
    if(config) {
        engine.updateFromZCSS(config.properties);
    }
}

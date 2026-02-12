import './style.css'; 
import { VolcaCore } from './volca';
import { ZCSSEngine } from './zcss';
// Import ZCSS file as raw string
import docZCSS from './docs.zcss?raw'; 

// Themes for buttons
const themes: Record<string, string> = {
    'neon': `
#doc-simulation {
    emitter: ring;
    gravity: 0.0;
    turbulence: 2.0;
    interaction: repel;
    gradient-start: #00e5ff; 
    gradient-end: #ff0077;
}`,
    'matrix': `
#doc-simulation {
    emitter: rain;
    gravity: -10.0;
    turbulence: 0.5;
    interaction: repel;
    gradient-start: #00ff00;
    gradient-end: #003300;
}`,
    'void': `
#doc-simulation {
    emitter: sphere;
    gravity: 0.0;
    turbulence: 5.0;
    interaction: attract;
    gradient-start: #ffffff;
    gradient-end: #3300ff;
}`
};

// 1. Boot Engine
const canvas = document.getElementById('volca-canvas') as HTMLCanvasElement;
const engine = new VolcaCore(canvas);

const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
window.addEventListener('resize', resize);
resize();

// 2. Initial Boot
async function start() {
    await engine.boot();
    // Parse the default docs.zcss
    const rules = ZCSSEngine.parse(docZCSS);
    const mainRule = rules.find(r => r.selector === '#doc-simulation');
    if(mainRule) engine.applyZCSS(mainRule.props);
}
start();

// 3. Expose Theme Switcher to Window
(window as any).setTheme = (name: string) => {
    const css = themes[name];
    if(!css) return;
    
    // Update Text
    document.getElementById('code-output')!.innerText = css.trim();
    
    // Update GPU
    const rules = ZCSSEngine.parse(css);
    const rule = rules.find(r => r.selector === '#doc-simulation');
    if(rule) engine.applyZCSS(rule.props);
};

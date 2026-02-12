import './styles.css'
import { VolcaCore } from './volca';
import { ZCSSEngine } from './zcss';
import sceneRaw from './scene.zcss?raw'; // Vite loads file string

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <canvas id="engine-view"></canvas>
  <div id="ui">
     <h1>Volca System</h1>
     <p>Processing ZCSS Config...</p>
  </div>
`

async function main() {
    const canvas = document.getElementById('engine-view') as HTMLCanvasElement;
    
    // Resize Handler
    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // 1. Parse ZCSS
    console.log("Parsing ZCSS...");
    const rules = ZCSSEngine.parse(sceneRaw);
    
    // Find our config
    const config = rules.find(r => r.selector === '#simulation-container');
    if(!config) throw new Error("No ZCSS Config found for simulation");

    // 2. Initialize Engine
    const engine = new VolcaCore(canvas);
    await engine.boot(config.params);

    document.querySelector('#ui p')!.innerText = "System Online";
}

main().catch(e => {
    console.error(e);
    document.querySelector('#ui p')!.innerHTML = `<span style="color:red">${e.message}</span>`;
});

import './style.css'
import { VolcaEngine } from './Volca'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <canvas id="volca-canvas" style="width: 100vw; height: 100vh; display: block;"></canvas>
  <div style="position: absolute; top: 20px; left: 20px; color: white; font-family: monospace;">
    <h1>Volca Engine</h1>
    <p>Simulating 1,000,000 GPU Particles</p>
  </div>
`

const canvas = document.getElementById('volca-canvas') as HTMLCanvasElement;

// Fit canvas to window
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Ignite the engine
// Increase number for heavier GPUs
const engine = new VolcaEngine(canvas, 1000000); 

engine.init().catch(err => {
    console.error(err);
    document.body.innerHTML = `<h1 style="color:white">WebGPU not enabled/supported</h1>`;
});

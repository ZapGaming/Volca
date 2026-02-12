import './style.css'; 
import { VolcaCore } from './volca';

// Default Params for Demo
let engine: VolcaCore;
const presets = {
    'inferno': { gravity: 2.0, turbulence: 1.5, mouseStrength: 100 },
    'rain':    { gravity: -5.0, turbulence: 0.2, mouseStrength: 20 },
    'nebula':  { gravity: 0.0, turbulence: 4.0, mouseStrength: -50 }, // Negative strength attracts
    'swarm':   { gravity: 0.0, turbulence: 8.0, mouseStrength: 150 },
};

async function init() {
    const canvas = document.getElementById('volca-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    // Resize Handler
    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // Init Engine
    engine = new VolcaCore(canvas);
    // Boot with "inferno"
    await engine.boot({ 
        count: 500000, 
        ...presets['inferno'] 
    });

    // Wire up Buttons
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // UI Toggle
            document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            (e.target as HTMLElement).classList.add('active');

            // Logic Switch
            const data = (e.target as HTMLElement).getAttribute('data-zcss') || '';
            const mode = data.split(':')[1].trim() as keyof typeof presets;
            
            console.log("Switching mode to:", mode);
            if(presets[mode] && engine) {
                engine.updateConfig(presets[mode]);
            }
        });
    });
}

init();

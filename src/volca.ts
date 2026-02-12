import { mat4 } from "gl-matrix";
import shaderWGSL from "./shaders.wgsl?raw";

// Hex to [r,g,b,a]
function parseColor(hex: string): Float32Array {
    if(!hex) return new Float32Array([1,1,1,1]);
    if(hex.startsWith('#')) hex = hex.slice(1);
    const bigint = parseInt(hex, 16);
    const r = ((bigint >> 16) & 255) / 255;
    const g = ((bigint >> 8) & 255) / 255;
    const b = (bigint & 255) / 255;
    return new Float32Array([r, g, b, 1.0]);
}

export class VolcaCore {
    canvas: HTMLCanvasElement;
    device!: GPUDevice;
    pipeline!: GPUComputePipeline;
    renderPipeline!: GPURenderPipeline;
    uBuf!: GPUBuffer;
    pBuf!: GPUBuffer;
    bgGroups!: GPUBindGroup[];

    // System State
    count: number = 500000;
    mouse = { x: 0, y: 0 };
    
    // ZCSS Mapped State
    params = {
        gravity: 0.0,
        turbulence: 1.0,
        mouseForce: 100.0, // Repel
        emitterType: 0, // 0 Sphere, 1 Ring, 2 Rain
        colorStart: new Float32Array([1, 0.2, 0, 1]), // Red
        colorEnd: new Float32Array([1, 1, 0, 1]),     // Yellow
    };

    mvp = mat4.create();
    proj = mat4.create();
    view = mat4.create();

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        window.addEventListener('mousemove', e => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });
    }

    // --- ZCSS INTERPRETER ---
    applyZCSS(props: Record<string, string>) {
        if(props['particle-count']) this.count = parseInt(props['particle-count']);
        
        // Physics
        if(props['gravity']) this.params.gravity = parseFloat(props['gravity']);
        if(props['turbulence']) this.params.turbulence = parseFloat(props['turbulence']);
        
        // Emitters
        if(props['emitter'] === 'ring') this.params.emitterType = 1;
        else if(props['emitter'] === 'rain') this.params.emitterType = 2;
        else if(props['emitter'] === 'sphere') this.params.emitterType = 0;
        
        // Interaction
        if(props['interaction'] === 'attract') this.params.mouseForce = -200.0;
        if(props['interaction'] === 'repel') this.params.mouseForce = 200.0;
        
        // Gradients (Hex support)
        if(props['gradient-start']) this.params.colorStart = parseColor(props['gradient-start']);
        if(props['gradient-end']) this.params.colorEnd = parseColor(props['gradient-end']);

        console.log("ZCSS Applied:", props);
    }

    async boot() {
        if (!navigator.gpu) throw new Error("WebGPU Not Supported");
        const adapter = await navigator.gpu.requestAdapter();
        this.device = await adapter!.requestDevice();
        const ctx = this.canvas.getContext('webgpu') as GPUCanvasContext;
        const fmt = navigator.gpu.getPreferredCanvasFormat();
        ctx.configure({ device: this.device, format: fmt, alphaMode: 'premultiplied' });

        this.initMem();
        this.initPipe(shaderWGSL, fmt);
        this.frame(0);
    }

    initMem() {
        // Uniform Size: Mat4(64) + colA(16) + colB(16) + 7 floats (28) = ~124 bytes
        this.uBuf = this.device.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.pBuf = this.device.createBuffer({ size: this.count * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }); // 32b particle
    }

    initPipe(code: string, fmt: GPUTextureFormat) {
        const mod = this.device.createShaderModule({ code });
        
        this.pipeline = this.device.createComputePipeline({ layout: 'auto', compute: { module:

import { mat4 } from "gl-matrix";
import shaderWGSL from "./shaders.wgsl?raw";

export class VolcaCore {
    canvas: HTMLCanvasElement;
    device!: GPUDevice;
    pipeline!: GPUComputePipeline;
    renderPipeline!: GPURenderPipeline;
    
    // Memory
    uBuf!: GPUBuffer;
    pBuf!: GPUBuffer;
    bgCommon0!: GPUBindGroup;
    bgCommon1!: GPUBindGroup;

    // State
    count: number = 200000;
    mouse = { x: 0, y: 0 };
    
    // ZCSS Properties
    config = {
        gravity: 0.0,
        turbulence: 1.0,
        mouseStrength: 0.0,
        timeScale: 1.0,
        colorMode: 0, // 0=Fire, 1=Water, 2=Texture
    };

    mvp = mat4.create();
    proj = mat4.create();
    view = mat4.create();

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        window.addEventListener('mousemove', (e) => {
            // Normalized Device Coordinates (-1 to +1)
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });
    }

    // This method is called by the ZCSS Parser to apply styles
    updateFromZCSS(params: any) {
        if(params.count) this.count = Number(params.count); // Requires reboot usually, simple demo
        
        // Physics
        if(params['physics-gravity']) this.config.gravity = parseFloat(params['physics-gravity']);
        if(params['physics-turbulence']) this.config.turbulence = parseFloat(params['physics-turbulence']);
        if(params['time-scale']) this.config.timeScale = parseFloat(params['time-scale']);
        
        // Interactivity
        if(params['interaction-repel']) this.config.mouseStrength = 50.0;
        if(params['interaction-attract']) this.config.mouseStrength = -50.0;
        
        // Visuals
        if(params['color-mode'] === 'ocean') this.config.colorMode = 1;
        else if(params['color-mode'] === 'fire') this.config.colorMode = 0;
    }

    async boot() {
        if (!navigator.gpu) throw new Error("WebGPU Not Supported");

        const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
        if (!adapter) throw new Error("No GPU Adapter Found");
        this.device = await adapter.requestDevice();
        
        const context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        const format = navigator.gpu.getPreferredCanvasFormat();
        
        context.configure({
            device: this.device,
            format: format,
            alphaMode: 'premultiplied'
        });

        this.initMemory();
        this.initPipelines(shaderWGSL, format);

        console.log(`[Volca] GPU Core Online. Threads: ${this.count}`);
        this.frame(0);
    }

    initMemory() {
        // Uniform Buffer (must be 16-byte aligned)
        // [MVP(64), Time(4), dt(4), grav(4), turb(4), mouseX(4), mouseY(4), str(4), timeScale(4), colorMode(4), pad(32)]
        const uSize = 256; 
        this.uBuf = this.device.createBuffer({
            size: uSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // Particle Buffer
        const pSize = this.count * 64; 
        this.pBuf = this.device.createBuffer({
            size: pSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 
        });
    }

    initPipelines(code: string, format: GPUTextureFormat) {
        const mod = this.device.createShaderModule({ code });

        // COMPUTE PIPELINE
        this.pipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: { module: mod, entryPoint: 'simulate' }
        });

        this.bgCommon0 = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uBuf } }]
        });
        
        this.bgCommon1 = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(1),
            entries: [{ binding: 0, resource: { buffer: this.pBuf } }]
        });

        // RENDER PIPELINE
        this.renderPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: { module: mod, entryPoint: 'vert_main' },
            fragment: { 
                module: mod, 
                entryPoint: 'frag_main', 
                targets: [{ 
                    format, 
                    blend: { 
                        color: {srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add'},
                        alpha: {srcFactor: 'zero', dstFactor: 'one', operation: 'add'}
                    }
                }]
            },
            primitive: { topology: 'point-list' }
        });
    }

    frame(time: number) {
        const dt = 0.016; 
        const t = time / 1000;

        // Visuals: Rotate camera
        const aspect = this.canvas.width / this.canvas.height;
        mat4.perspective(this.proj, Math.PI / 4, aspect, 1, 1000);
        mat4.lookAt(this.view, [0, 0, 80], [0,0,0], [0,1,0]);
        mat4.multiply(this.mvp, this.proj, this.view);

        // Upload Data
        const d = new Float32Array(40); // larger buffer for data
        d.set(this.mvp); // 0-15
        d[16] = t;
        d[17] = dt;
        d[18] = this.config.gravity;
        d[19] = this.config.turbulence;
        
        // Interaction
        d[20] = this.mouse.x;
        d[21] = this.mouse.y;
        d[22] = this.config.mouseStrength;
        
        // Advanced Props
        d[23] = this.config.timeScale;
        d[24] = this.config.colorMode; 

        this.device.queue.writeBuffer(this.uBuf, 0, d);

        const enc = this.device.createCommandEncoder();

        // 1. Compute Physics
        const cPass = enc.beginComputePass();
        cPass.setPipeline(this.pipeline);
        cPass.setBindGroup(0, this.bgCommon0);
        cPass.setBindGroup(1, this.bgCommon1);
        cPass.dispatchWorkgroups(Math.ceil(this.count / 64));
        cPass.end();

        // 2. Render Screen
        const rPass = enc.beginRenderPass({
            colorAttachments: [{
                view: (this.canvas.getContext('webgpu') as GPUCanvasContext).getCurrentTexture().createView(),
                loadOp: 'clear', storeOp: 'store', clearValue: { r:0, g:0, b:0, a:0 }
            }]
        });
        rPass.setPipeline(this.renderPipeline);
        rPass.setBindGroup(0, this.bgCommon0); // Params
        rPass.setBindGroup(1, this.bgCommon1); // Particles
        rPass.draw(this.count);
        rPass.end();

        this.device.queue.submit([enc.finish()]);
        requestAnimationFrame((t) => this.frame(t));
    }
}

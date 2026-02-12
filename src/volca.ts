import { mat4 } from "gl-matrix";
import shaderWGSL from "./shaders.wgsl?raw";

export class VolcaCore {
    canvas: HTMLCanvasElement;
    device!: GPUDevice;
    pipeline!: GPUComputePipeline;
    renderPipeline!: GPURenderPipeline;
    
    // Memory
    uBuf!: GPUBuffer; // Uniform Buffer
    pBuf!: GPUBuffer; // Particle Storage
    bgCommon0!: GPUBindGroup;
    bgCommon1!: GPUBindGroup;

    // Simulation State
    count: number = 200000;
    
    // Physics Parameters (Changeable at runtime)
    config = {
        gravity: 0.0,
        turbulence: 1.0,
        mouseStrength: 50.0 // + Repel, - Attract
    };
    
    // Interaction
    mouse = { x: 0, y: 0 };

    mvp = mat4.create();
    proj = mat4.create();
    view = mat4.create();

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        // Listen to mouse globally or on canvas
        window.addEventListener('mousemove', (e) => {
            // Normalize -1 to 1
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });
    }

    // Call this to live-update settings from the Showcase UI
    updateConfig(newConfig: Partial<typeof this.config>) {
        this.config = { ...this.config, ...newConfig };
    }

    async boot(params: any) {
        if (!navigator.gpu) throw new Error("WebGPU Not Supported");
        
        // Initial param load
        if(params.count) this.count = Number(params.count);
        this.updateConfig({
            gravity: Number(params['physics-gravity'] || 0),
            turbulence: Number(params['physics-turbulence'] || 1)
        });

        const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
        this.device = await adapter!.requestDevice();
        
        const context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        context.configure({
            device: this.device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: 'premultiplied'
        });

        this.initBuffers();
        this.initPipelines(shaderWGSL, navigator.gpu.getPreferredCanvasFormat());

        console.log(`[Volca] Initialized. Count: ${this.count}`);
        this.frame(0);
    }

    initBuffers() {
        // Uniform Buffer Size calculation
        // Mat4(64) + Time(4)+dt(4)+grav(4)+turb(4) + mouseX(4)+mouseY(4)+str(4)+aspect(4) = ~100 bytes -> 128 padding
        this.uBuf = this.device.createBuffer({
            size: 256, // Generous padding
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.pBuf = this.device.createBuffer({
            size: this.count * 64, // 64 bytes per particle
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 
        });
    }

    initPipelines(code: string, format: GPUTextureFormat) {
        const mod = this.device.createShaderModule({ code });

        this.pipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: { module: mod, entryPoint: 'simulate' }
        });

        // Cache bind groups so we don't recreate them every frame
        this.bgCommon0 = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uBuf } }]
        });
        this.bgCommon1 = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(1),
            entries: [{ binding: 0, resource: { buffer: this.pBuf } }]
        });

        this.renderPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: { module: mod, entryPoint: 'vert_main' },
            fragment: { 
                module: mod, entryPoint: 'frag_main', 
                targets: [{ 
                    format, 
                    blend: { // Super Bright Additive Blending
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
        const aspect = this.canvas.width / this.canvas.height;

        // Visuals: Rotate camera
        mat4.perspective(this.proj, Math.PI / 4, aspect, 1, 1000);
        mat4.lookAt(this.view, [0, 0, 80], [0,0,0], [0,1,0]);
        mat4.multiply(this.mvp, this.proj, this.view);

        // Upload Data
        const d = new Float32Array(32); 
        d.set(this.mvp); // 0-15
        d[16] = t;
        d[17] = dt;
        d[18] = this.config.gravity;
        d[19] = this.config.turbulence;
        
        // Mouse Data
        d[20] = this.mouse.x;
        d[21] = this.mouse.y;
        d[22] = this.config.mouseStrength;
        d[23] = aspect;

        this.device.queue.writeBuffer(this.uBuf, 0, d);

        const enc = this.device.createCommandEncoder();

        // COMPUTE PASS
        const cPass = enc.beginComputePass();
        cPass.setPipeline(this.pipeline);
        cPass.setBindGroup(0, this.bgCommon0);
        cPass.setBindGroup(1, this.bgCommon1);
        cPass.dispatchWorkgroups(Math.ceil(this.count / 64));
        cPass.end();

        // RENDER PASS
        const rPass = enc.beginRenderPass({
            colorAttachments: [{
                view: (this.canva

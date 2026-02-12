// src/volca.ts
import { mat4 } from "gl-matrix";
// Make sure src/shaders.wgsl exists!
import shaderWGSL from "./shaders.wgsl?raw";

export class VolcaCore {
    canvas: HTMLCanvasElement;
    device!: GPUDevice;
    pipeline!: GPUComputePipeline;
    renderPipeline!: GPURenderPipeline;
    
    // Memory
    pBuf!: GPUBuffer;
    uBuf!: GPUBuffer;
    bindGroupCompute0!: GPUBindGroup;
    bindGroupCompute1!: GPUBindGroup;

    // Config defaults
    count: number = 500000;
    gravity: number = 0.0;
    turbulence: number = 1.0;

    // Matrices
    mvp = mat4.create();
    proj = mat4.create();
    view = mat4.create();

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    async boot(config: any) {
        if (!navigator.gpu) throw new Error("WebGPU Not Supported");

        if(config.count) this.count = Number(config.count);
        if(config['physics-gravity']) this.gravity = Number(config['physics-gravity']);
        if(config['physics-turbulence']) this.turbulence = Number(config['physics-turbulence']);

        const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
        if (!adapter) throw new Error("No GPU Adapter found");
        
        this.device = await adapter.requestDevice();
        
        const context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device: this.device, format, alphaMode: 'premultiplied' });

        this.initMemory();
        this.initPipelines(shaderWGSL, format);

        console.log(`[Volca] GPU Online. Particles: ${this.count}`);
        this.frame(0);
    }

    initMemory() {
        // Aligning structure sizes: Matrix(64) + Time(4) + dt(4) + Grav(4) + Turb(4) + pad(8) = 88 bytes -> 96 bytes aligned
        this.uBuf = this.device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // 64 bytes per particle * count
        const pSize = this.count * 64; 
        this.pBuf = this.device.createBuffer({
            size: pSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 
        });
    }

    initPipelines(code: string, format: GPUTextureFormat) {
        const mod = this.device.createShaderModule({ code });
        
        this.pipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: { module: mod, entryPoint: 'simulate' }
        });

        this.bindGroupCompute0 = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: this.uBuf } }]
        });
        
        this.bindGroupCompute1 = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(1),
            entries: [{ binding: 0, resource: { buffer: this.pBuf } }]
        });

        this.renderPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: { module: mod, entryPoint: 'vert_main' },
            fragment: { module: mod, entryPoint: 'frag_main', targets: [{ 
                format,
                blend: { 
                    color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add'},
                    alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add'}
                }
            }]},
            primitive: { topology: 'point-list' }
        });
    }

    frame(time: number) {
        const dt = 0.016; 
        const t = time / 1000;

        // Camera Logic
        const aspect = this.canvas.width / this.canvas.height;
        mat4.perspective(this.proj, Math.PI / 4, aspect, 0.1, 1000);
        // Slowly rotate camera
        mat4.lookAt(this.view, [Math.sin(t * 0.2)*40, 10, Math.cos(t * 0.2)*40], [0,0,0], [0,1,0]);
        mat4.multiply(this.mvp, this.proj, this.view);

        // Update Uniforms
        const uArr = new Float32Array(32); 
        uArr.set(this.mvp); // 0-15
        uArr[16] = t;
        uArr[17] = dt;
        uArr[18] = this.gravity;
        uArr[19] = this.turbulence;
        this.device.queue.writeBuffer(this.uBuf, 0, uArr);

        // Command Encoding
        const enc = this.device.createCommandEncoder();
        
        const cPass = enc.beginComputePass();
        cPass.setPipeline(this.pipeline);
        cPass.setBindGroup(0, this.bindGroupCompute0);
        cPass.setBindGroup(1, this.bindGroupCompute1);
        cPass.dispatchWorkgroups(Math.ceil(this.count / 64));
        cPass.end();

        const ctx = this.canvas.getContext('webgpu') as GPUCanvasContext;
        const rPass = enc.beginRenderPass({
            colorAttachments: [{
                view: ctx.getCurrentTexture().createView(),
                loadOp: 'clear', storeOp: 'store', clearValue: {r:0,g:0,b:0,a:0} // Transparent for DOM background
            }]
        });
        
        rPass.setPipeline(this.renderPipeline);
        // Note: RenderPipeline creates its own bindgroup layout derived from shader
        // Since we used 'auto', the slots match the shader groups. 
        // @group(0) is Params, @group(1) is Particles
        rPass.setBindGroup(0, this.bindGroupCompute0); 
        rPass.setBindGroup(1, this.bindGroupCompute1); 
        rPass.draw(this.count);
        rPass.end();

        this.device.queue.submit([enc.finish()]);
        requestAnimationFrame((t) => this.frame(t));
    }
}

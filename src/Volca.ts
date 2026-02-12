import { mat4 } from "gl-matrix";
import shaderCode from "./shaders.wgsl?raw"; // Ensure your vite config supports ?raw or use a string

export class VolcaEngine {
  canvas: HTMLCanvasElement;
  adapter!: GPUAdapter;
  device!: GPUDevice;
  context!: GPUCanvasContext;

  // Buffers
  particleBuffer!: GPUBuffer;
  uniformBuffer!: GPUBuffer;

  // Pipelines
  computePipeline!: GPUComputePipeline;
  renderPipeline!: GPURenderPipeline;

  // Bind Groups
  computeBindGroup!: GPUBindGroup;
  renderBindGroup!: GPUBindGroup; // Usually often same as compute or split, we'll split logic if needed

  // State
  numParticles: number;
  projectionMatrix = mat4.create();
  viewMatrix = mat4.create();
  modelViewProjectionMatrix = mat4.create();
  
  startTime: number = 0;

  constructor(canvas: HTMLCanvasElement, numParticles: number = 1000000) {
    this.canvas = canvas;
    this.numParticles = numParticles;
  }

  async init() {
    // 1. WebGPU Initialization
    if (!navigator.gpu) throw new Error("WebGPU not supported on this browser.");
    
    this.adapter = (await navigator.gpu.requestAdapter({
        powerPreference: "high-performance" // Critical for explosions
    }))!;
    
    this.device = await this.adapter.requestDevice();
    this.context = this.canvas.getContext("webgpu") as GPUCanvasContext;

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: presentationFormat,
      alphaMode: 'premultiplied' // blend modes
    });

    // 2. Initialize Buffers
    this.initBuffers();

    // 3. Create Pipelines
    await this.initPipelines(presentationFormat);

    this.startTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  initBuffers() {
    // A. Uniform Buffer (Matrix + Time)
    // 64 bytes (Matrix) + 4 (Time) + 4 (Delta) = 72 bytes -> align to 16 -> 80 bytes needed? 
    // Actually WebGPU prefers 256 byte alignment for offsets, but total size just needs to match struct.
    const uniformBufferSize = 64 + 4 + 4 + 8; // padding
    this.uniformBuffer = this.device.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // B. Particle Buffer
    // Struct Particle: pos(vec4=16) + vel(vec4=16) + color(vec4=16) + life(f32=4) = 52 bytes.
    // Alignment often bumps this to 64 bytes per particle for safe access.
    const particleStructSize = 64; 
    const totalParticleSize = this.numParticles * particleStructSize;
    
    this.particleBuffer = this.device.createBuffer({
      size: totalParticleSize,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, // Vertex for drawing, Storage for physics
    });

    // C. Initial Data Generation (The "Setup Explosion")
    const particleData = new Float32Array(this.numParticles * (particleStructSize / 4));
    for (let i = 0; i < this.numParticles; i++) {
        const offset = i * (particleStructSize / 4);
        
        // Initial Position (Origin)
        particleData[offset + 0] = 0;
        particleData[offset + 1] = 0;
        particleData[offset + 2] = 0;
        particleData[offset + 3] = 1; // w

        // Initial Velocity (Random Spherical Explosion)
        const speed = Math.random() * 5.0 + 2.0; 
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        
        particleData[offset + 4] = speed * Math.sin(phi) * Math.cos(theta); // vx
        particleData[offset + 5] = speed * Math.sin(phi) * Math.sin(theta); // vy
        particleData[offset + 6] = speed * Math.cos(phi);                   // vz
        particleData[offset + 7] = 0; // padding/extra

        // Color (Fire: Red/Orange/Yellow mix)
        particleData[offset + 8] = 1.0; // r
        particleData[offset + 9] = Math.random() * 0.5 + 0.2; // g
        particleData[offset + 10] = 0.0; // b
        particleData[offset + 11] = 1.0; // a

        // Life
        particleData[offset + 12] = Math.random(); // Start at random life cycles
    }
    this.device.queue.writeBuffer(this.particleBuffer, 0, particleData);
  }

  async initPipelines(presentationFormat: GPUTextureFormat) {
    const shaderModule = this.device.createShaderModule({ code: shaderCode });

    // --- COMPUTE PIPELINE ---
    this.computePipeline = this.device.createComputePipeline({
      layout: "auto",
      compute: { module: shaderModule, entryPoint: "simulate" },
    });

    // Bind Group for Compute
    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0), // Uses "auto" layout detection
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.particleBuffer } },
      ],
    });

    // --- RENDER PIPELINE ---
    this.renderPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vert_main",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "frag_main",
        targets: [
          {
            format: presentationFormat,
            blend: { // Additive blending for "glowing fire" look
                color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
                alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' },
            }
          },
        ],
      },
      primitive: {
        topology: "point-list", // Drawing dots is fastest for millions
      },
    });

    // Assuming same bind group structure for uniform/storage reuse in vertex shader
    // (Our shader used group(0) for uniform, so we can technically reuse/remake)
    // The vertex shader reads uniforms from group 0, but reads particle POS from built-in input if using vertex buffers
    // OR it reads from storage buffer if we use Pull-Model.
    // In Shader code I wrote earlier: `particles[instanceIndex]`. That is accessing Storage Buffer.
    // So we need to bind the Storage Buffer to the Render Pipeline too.
    
    // We can reuse the compute bind group if the layouts match, 
    // or create a specific one if render pipeline has different layout visibility requirements.
    // For simplicity, let's create a specific one that matches shader logic.
    this.renderBindGroup = this.device.createBindGroup({
        layout: this.renderPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: this.uniformBuffer } },
            // Note: Shader code needs adjustment? 
            // In shader: Uniform is @group(0), Particles is @group(1).
            // Render pipeline usually implicitly defines layout from shader code.
        ]
    });
    
    // BUT wait, my previous shader def was:
    // @group(0) uniform
    // @group(1) particles
    // Render pipeline creates BindGroupLayouts [0] and [1].
    // I need TWO bind groups for render then.
  }
  
  // Need to get bind group for set 1 (particles) from pipeline
  getRenderParticleBindGroup() {
      return this.device.createBindGroup({
          layout: this.renderPipeline.getBindGroupLayout(1), // Group 1 in shader
          entries: [{ binding: 0, resource: { buffer: this.particleBuffer } }]
      })
  }

  updateUniforms(deltaTime: number, time: number) {
      // Perspective
      const aspect = this.canvas.width / this.canvas.height;
      mat4.perspective(this.projectionMatrix, (45 * Math.PI) / 180, aspect, 0.1, 1000.0);
      
      // Camera rotating around center
      const radius = 20.0;
      const camX = Math.sin(time * 0.2) * radius;
      const camZ = Math.cos(time * 0.2) * radius;
      
      mat4.lookAt(this.viewMatrix, [camX, 2.0, camZ], [0, 0, 0], [0, 1, 0]);
      mat4.multiply(this.modelViewProjectionMatrix, this.projectionMatrix, this.viewMatrix);

      // Write to Buffer
      const uniformData = new Float32Array(20); // enough space
      uniformData.set(this.modelViewProjectionMatrix);
      uniformData[16] = time;
      uniformData[17] = deltaTime;
      
      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  loop(timestamp: number) {
      const now = timestamp / 1000;
      const dt = Math.min(now - (this.lastTime || now), 0.1);
      this.lastTime = now;

      this.updateUniforms(dt, now);

      const commandEncoder = this.device.createCommandEncoder();

      // 1. Compute Pass (Physics)
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(this.computePipeline);
      passEncoder.setBindGroup(0, this.computeBindGroup); // Group 0 (Uniforms)
      passEncoder.setBindGroup(1, this.device.createBindGroup({ // Group 1 (Particles)
          layout: this.computePipeline.getBindGroupLayout(1),
          entries: [{ binding: 0, resource: { buffer: this.particleBuffer } }]
      }));
      // Dispatch: numParticles / workgroup_size (64)
      passEncoder.dispatchWorkgroups(Math.ceil(this.numParticles / 64));
      passEncoder.end();

      // 2. Render Pass (Visuals)
      const textureView = this.context.getCurrentTexture().createView();
      const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [{
          view: textureView,
          clearValue: { r: 0.05, g: 0.05, b: 0.05, a: 1.0 }, // Dark background
          loadOp: "clear",
          storeOp: "store",
        }],
      };

      const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
      renderPass.setPipeline(this.renderPipeline);
      renderPass.setBindGroup(0, this.renderBindGroup); // Group 0 (Uniforms)
      renderPass.setBindGroup(1, this.getRenderParticleBindGroup()); // Group 1 (Particles)
      
      // Draw 1 vertex per instance (or per particle if doing point list logic)
      // Since vertex shader accesses array via index, we simulate "vertices" 
      renderPass.draw(this.numParticles, 1, 0, 0); 
      renderPass.end();

      this.device.queue.submit([commandEncoder.finish()]);
      requestAnimationFrame((t) => this.loop(t));
  }
  
  lastTime = 0;
}

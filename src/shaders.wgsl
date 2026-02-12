struct Uniforms {
  modelViewProjectionMatrix : mat4x4<f32>,
  time : f32,
  dt : f32,
  gravity : f32,
  turbulence : f32,
  // NEW: Mouse Interaction (x, y, strength, radius)
  mouseX: f32,
  mouseY: f32,
  mouseStrength: f32,
  screenAspect: f32,
}
@group(0) @binding(0) var<uniform> params : Uniforms;

struct Particle {
  pos : vec4<f32>,
  vel : vec4<f32>,
  life : f32,
  scale : f32,
  dummy1: f32, dummy2: f32, // Padding
}
@group(1) @binding(0) var<storage, read_write> particles : array<Particle>;

// Optimized Simplex Noise
fn hash(n: f32) -> f32 { return fract(sin(n) * 43758.5453123); }

fn noise(p: vec3<f32>) -> f32 {
    let i = floor(p); let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    let n = p.z; // Simple mix
    return mix(mix(hash(n+0.0), hash(n+1.0), f.x),
               mix(hash(n+1.0), hash(n+2.0), f.x), f.y);
}

@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) global_id : vec3<u32>) {
  let idx = global_id.x;
  if (idx >= arrayLength(&particles)) { return; }

  var p = particles[idx];

  // --- PHYSICS KERNEL ---
  
  // 1. Environmental Forces (Gravity/Turbulence)
  var force = vec4<f32>(0.0, params.gravity, 0.0, 0.0);
  
  // Curl Noise approximation for fluid look
  let tOffset = params.time * 0.5;
  let tx = noise(p.pos.xyz * 0.5 + tOffset);
  let ty = noise(p.pos.xyz * 0.5 + tOffset + 13.0);
  force += vec4<f32>(tx - 0.5, ty - 0.5, 0.0, 0.0) * params.turbulence * 10.0;

  // 2. INTERACTION (Mouse Logic)
  // Convert 3D World Pos to rough 2D Screen Space for interaction
  let dx = p.pos.x - (params.mouseX * 50.0); // Rough projection mapping
  let dy = p.pos.y - (params.mouseY * 50.0); 
  let distSq = dx*dx + dy*dy;
  
  if (distSq < 100.0 && params.mouseStrength != 0.0) {
      // Repel or Attract
      let dir = normalize(vec4<f32>(dx, dy, 0.0, 0.0));
      force += dir * params.mouseStrength * (20.0 / (distSq + 1.0));
  }

  // Integration
  p.vel += force * params.dt;
  p.vel *= 0.96; // Friction/Drag
  p.pos += p.vel * params.dt;
  
  // Lifecycle Management
  p.life -= 0.1 * params.dt;
  if (p.life <= 0.0 || p.pos.y < -30.0 || p.pos.y > 30.0) {
      p.life = 1.0;
      // Respawn at randomized location
      let rX = (hash(f32(idx) + params.time) - 0.5) * 60.0;
      let rY = (hash(f32(idx) + params.time + 10.0) - 0.5) * 40.0;
      p.pos = vec4<f32>(rX, rY, 0.0, 1.0);
      p.vel = vec4<f32>(0.0);
  }

  particles[idx] = p;
}

@vertex
fn vert_main(@builtin(instance_index) idx : u32) -> @builtin(position) vec4<f32> {
  let p = particles[idx];
  // Point size attenuation
  return params.modelViewProjectionMatrix * p.pos;
}

@fragment
fn frag_main() -> @location(0) vec4<f32> {
  // Fire/Neon look
  return vec4<f32>(1.0, 0.6, 0.2, 0.4); 
}

struct Uniforms {
  mvp : mat4x4<f32>,
  time : f32,
  dt : f32,
  gravity : f32,
  turbulence : f32,
  mouseX: f32,
  mouseY: f32,
  mouseStr: f32,
  timeScale: f32,
  colorMode: f32,
}
@group(0) @binding(0) var<uniform> params : Uniforms;

struct Particle {
  pos : vec4<f32>,
  vel : vec4<f32>,
  life : f32,
  scale : f32,
  d1: f32, d2: f32, // pad
}
@group(1) @binding(0) var<storage, read_write> particles : array<Particle>;

// Hash/Noise Logic
fn hash(n: f32) -> f32 { return fract(sin(n) * 43758.5453123); }

fn noise(p: vec3<f32>) -> f32 {
    let i = floor(p); let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    let n = p.z;
    return mix(mix(hash(n), hash(n+1.0), f.x), mix(hash(n+1.0), hash(n+2.0), f.x), f.y);
}

@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) id : vec3<u32>) {
  let i = id.x;
  if (i >= arrayLength(&particles)) { return; }
  var p = particles[i];

  // Logic
  var forces = vec4<f32>(0.0, params.gravity, 0.0, 0.0);
  
  // Turbulence
  let scale = 0.8;
  let t = params.time * params.timeScale;
  let nx = noise(p.pos.xyz * scale + t);
  let ny = noise(p.pos.xyz * scale + t + 50.0);
  forces += vec4<f32>(nx-0.5, ny-0.5, 0.0, 0.0) * params.turbulence * 10.0;

  // Interaction
  let dx = p.pos.x - (params.mouseX * 50.0);
  let dy = p.pos.y - (params.mouseY * 40.0);
  let distSq = dx*dx + dy*dy + 0.1;
  if(distSq < 150.0) {
      forces += vec4<f32>(dx, dy, 0.0, 0.0) * (params.mouseStr / distSq) * 10.0;
  }

  p.vel += forces * params.dt;
  p.vel *= 0.95; // Drag
  p.pos += p.vel * params.dt;
  
  p.life -= 0.1 * params.dt * params.timeScale;
  
  // Respawn
  if(p.life <= 0.0 || abs(p.pos.x) > 70.0 || abs(p.pos.y) > 50.0) {
      p.life = 1.0;
      let rx = (hash(f32(i) + t) - 0.5) * 80.0;
      let ry = (hash(f32(i) + t + 20.0) - 0.5) * 50.0;
      p.pos = vec4<f32>(rx, ry, 0.0, 1.0);
      p.vel = vec4<f32>(0.0);
  }
  
  particles[i] = p;
}

@vertex
fn vert_main(@builtin(instance_index) i : u32) -> @builtin(position) vec4<f32> {
  return params.mvp * particles[i].pos;
}

@fragment
fn frag_main() -> @location(0) vec4<f32> {
  if (params.colorMode > 0.5) {
     // OCEAN MODE (Cyan/Purple)
     return vec4<f32>(0.0, 0.8, 1.0, 0.6);
  }
  // FIRE MODE (Default)
  return vec4<f32>(1.0, 0.4, 0.05, 0.8);
}

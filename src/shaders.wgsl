struct Uniforms {
  mvp : mat4x4<f32>,
  colorStart : vec4<f32>, // ZCSS Gradient A
  colorEnd : vec4<f32>,   // ZCSS Gradient B
  gravity : f32,
  turbulence : f32,
  time : f32,
  dt : f32,
  mouseX : f32,
  mouseY : f32,
  mouseForce : f32,       // Repel/Attract
  emitterType : f32,      // 0=Sphere, 1=Ring, 2=Wall
}
@group(0) @binding(0) var<uniform> u : Uniforms;

struct Particle {
  pos : vec4<f32>,
  vel : vec4<f32>,
  life : f32,
  padding : f32, d1: f32, d2: f32,
}
@group(1) @binding(0) var<storage, read_write> particles : array<Particle>;

// --- NOISE FUNCTIONS ---
fn hash(n: f32) -> f32 { return fract(sin(n) * 43758.5453123); }
fn snoise(p: vec3<f32>) -> f32 {
    let i = floor(p); let f = fract(p);
    let u = f*f*(3.0-2.0*f);
    let n = p.z;
    return mix(mix(hash(n), hash(n+1.), f.x), mix(hash(n+1.), hash(n+2.), f.x), f.y);
}

@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) id : vec3<u32>) {
  let i = id.x;
  if (i >= arrayLength(&particles)) { return; }
  var p = particles[i];

  // 1. FORCES
  var acc = vec4<f32>(0.0, u.gravity, 0.0, 0.0);
  
  // Turbulence (Perlin Flow)
  let tScale = 0.5;
  let noiseT = u.time * 0.5;
  let n1 = snoise(p.pos.xyz * tScale + noiseT);
  let n2 = snoise(p.pos.xyz * tScale + noiseT + 100.0);
  let n3 = snoise(p.pos.xyz * tScale + noiseT + 200.0);
  acc += vec4<f32>(n1-0.5, n2-0.5, n3-0.5, 0.0) * u.turbulence * 15.0;

  // Interaction (Mouse)
  let dx = p.pos.x - (u.mouseX * 60.0);
  let dy = p.pos.y - (u.mouseY * 40.0); // Aspect correction approx
  let dist = dx*dx + dy*dy + 0.1;
  if(dist < 200.0) {
     let dir = normalize(vec4<f32>(dx, dy, 0.0, 0.0));
     acc += dir * (u.mouseForce / dist) * 50.0;
  }

  p.vel += acc * u.dt;
  p.vel *= 0.96; // Drag
  p.pos += p.vel * u.dt;
  p.life -= 0.2 * u.dt;

  // 2. RESPAWN LOGIC (Based on Emitter Shape)
  if (p.life <= 0.0) {
      p.life = 1.0;
      let r1 = hash(f32(i) + u.time);
      let r2 = hash(f32(i) + u.time + 10.0);
      let r3 = hash(f32(i) + u.time + 20.0);
      
      if (u.emitterType < 0.5) { 
          // TYPE 0: Sphere Explosion
          p.pos = vec4<f32>(0.0, 0.0, 0.0, 1.0);
          let phi = r1 * 6.28; let costheta = 2.0*r2 - 1.0;
          let theta = acos(costheta);
          let rad = 20.0 + r3 * 10.0; // Explosion speed
          p.vel = vec4<f32>(rad*sin(theta)*cos(phi), rad*sin(theta)*sin(phi), rad*cos(theta), 0.0);
      } else if (u.emitterType < 1.5) {
          // TYPE 1: Ring/Portal
          let angle = r1 * 6.283;
          let radius = 30.0;
          p.pos = vec4<f32>(cos(angle)*radius, sin(angle)*radius, 0.0, 1.0);
          p.vel = vec4<f32>(0.0, 0.0, (r2 - 0.5) * 10.0, 0.0); // Move forward/back
      } else {
          // TYPE 2: Digital Rain (Wall)
          p.pos = vec4<f32>((r1 - 0.5) * 100.0, 40.0, (r2-0.5)*20.0, 1.0);
          p.vel = vec4<f32>(0.0, -10.0 - (r3*20.0), 0.0, 0.0);
      }
  }

  particles[i] = p;
}

@vertex
fn vert_main(@builtin(instance_index) i : u32) -> @builtin(position) vec4<f32> {
  return u.mvp * particles[i].pos;
}

@fragment
fn frag_main() -> @location(0) vec4<f32> {
  // GRADIENT MIXING: Based on Fragment coordinate for "Scanline" look
  // Or simply mixing colorStart -> colorEnd
  return mix(u.colorEnd, u.colorStart, 0.5); // Simplified blend
}

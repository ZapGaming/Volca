struct Uniforms {
  modelViewProjectionMatrix : mat4x4<f32>,
  time : f32,
  dt : f32,
  gravity : f32,
  turbulence : f32,
}
@group(0) @binding(0) var<uniform> params : Uniforms;

struct Particle {
  pos : vec4<f32>,
  vel : vec4<f32>,
  life : f32,
  scale : f32,
  r : f32, g: f32, // Simplified color storage
}
@group(1) @binding(0) var<storage, read_write> particles : array<Particle>;

// Random helper
fn hash(n: f32) -> f32 { return fract(sin(n) * 43758.5453123); }

// 3D Simplex Noise for realistic fluid movement
fn noise(p: vec3<f32>) -> f32 {
    let i = floor(p); let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(dot(i, vec3<f32>(1.,57.,113.))), 
                       hash(dot(i + vec3<f32>(1.,0.,0.), vec3<f32>(1.,57.,113.))), u.x),
                   mix(hash(dot(i + vec3<f32>(0.,1.,0.), vec3<f32>(1.,57.,113.))), 
                       hash(dot(i + vec3<f32>(1.,1.,0.), vec3<f32>(1.,57.,113.))), u.x), u.y),
               mix(mix(hash(dot(i + vec3<f32>(0.,0.,1.), vec3<f32>(1.,57.,113.))), 
                       hash(dot(i + vec3<f32>(1.,0.,1.), vec3<f32>(1.,57.,113.))), u.x),
                   mix(hash(dot(i + vec3<f32>(0.,1.,1.), vec3<f32>(1.,57.,113.))), 
                       hash(dot(i + vec3<f32>(1.,1.,1.), vec3<f32>(1.,57.,113.))), u.x), u.y), u.z);
}

@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) global_id : vec3<u32>) {
  let idx = global_id.x;
  if (idx >= arrayLength(&particles)) { return; }

  var p = particles[idx];
  
  if (p.life > 0.0) {
     // PHYSICS ENGINE LOGIC
     // 1. Gravity from ZCSS
     let g = vec4<f32>(0.0, params.gravity, 0.0, 0.0);
     
     // 2. Curl Turbulence (The Swirly Effect)
     let scale = 0.5;
     let tx = noise(p.pos.xyz * scale + params.time);
     let ty = noise(p.pos.xyz * scale + params.time + 33.1);
     let tz = noise(p.pos.xyz * scale + params.time + 11.2);
     let turb = vec4<f32>(tx - 0.5, ty - 0.5, tz - 0.5, 0.0) * params.turbulence * 10.0;

     p.vel += (g + turb) * params.dt;
     p.pos += p.vel * params.dt;
     p.life -= 0.3 * params.dt; // decay
  } else {
     // RESPAWN (Explosion Cycle)
     p.life = 1.0;
     p.pos = vec4<f32>(0.0, 0.0, 0.0, 1.0); // Reset to center
     
     // Explode outwards randomly
     let seed = params.time + f32(idx);
     p.vel = vec4<f32>(
         (hash(seed) - 0.5) * 15.0, 
         (hash(seed + 1.0) * 15.0), 
         (hash(seed + 2.0) - 0.5) * 15.0, 
         0.0
     );
  }
  
  particles[idx] = p;
}

@vertex
fn vert_main(@builtin(instance_index) idx : u32) -> @builtin(position) vec4<f32> {
  let p = particles[idx];
  return params.modelViewProjectionMatrix * p.pos;
}

@fragment
fn frag_main() -> @location(0) vec4<f32> {
  // Fire/Laser Color Aesthetic
  return vec4<f32>(1.0, 0.4, 0.1, 1.0);
}

export const screenVertex = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
`

export const backgroundFragment = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uPulse;
  uniform vec2 uResolution;
  uniform float uGentle;
  const float PI = 3.14159265359;
  mat2 rot(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+1.), f.x), f.y);
  }
  float fbm(vec2 p) {
    float f = 0.; float a = .5;
    for (int i = 0; i < 4; i++) { f += a*noise(p); p = rot(.5)*p*2.03; a *= .5; }
    return f;
  }
  vec3 gold(float intensity) { return vec3(1., .39, .09)*intensity + vec3(1., .79, .45)*pow(max(intensity-.6,0.), 1.2)*.4; }
  vec3 stars(vec2 uv) {
    vec2 p = uv*180.; vec2 id = floor(p); vec2 f = fract(p)-.5;
    float rnd = hash(id);
    float star = smoothstep(.994, 1., rnd)*exp(-length(f)*22.);
    return vec3(.7,.78,.9)*star*(.7+.3*sin(uTime*.7+rnd*120.));
  }
  vec3 blackhole(vec2 p) {
    float growth = mix(3.8, .9, smoothstep(0.,7.5,uTime));
    p.x -= .28;
    p *= growth;
    p = rot(-.23)*p;
    float r = length(p);
    float theta = atan(p.y,p.x);
    vec3 col = gold(.024/(r*r+.025));
    float photon = .011/(abs(r-.42)+.008);
    photon *= .8 + .18*sin(theta*3.+uTime*.6);
    col += gold(photon*.68);
    vec2 disc = vec2(p.x, p.y*5.8);
    float dr = length(disc);
    float da = atan(disc.y,disc.x);
    float density = smoothstep(.43,.53,dr)*exp(-max(dr-.53,0.)*2.6);
    float filaments = pow(.5+.5*sin(dr*115.-da*3.-uTime*3.+fbm(disc*9.)*6.),3.);
    float turbulence = .25+.75*fbm(vec2(dr*17.-uTime,da*4.));
    float disk = density*(.32+filaments*.8)*turbulence;
    float front = 1.-smoothstep(-.08,.0,p.y);
    float occlusion = smoothstep(.405,.435,r);
    col += gold(disk*3.7)*max(front,occlusion);
    col *= mix(occlusion,1.,front*.6);
    col += gold(.004/(abs(p.y+.004)+.01)*exp(-abs(p.x)*1.7))*.34;
    float halo = exp(-abs(r-.43)*16.)*.16;
    col += gold(halo);
    return col;
  }
  vec3 tunnel(vec2 p) {
    float t = uTime-15.;
    p *= 1.-uPulse*.045;
    p += vec2(sin(t*.85)*.12,cos(t*.73)*.065);
    p = rot(sin(t*.35)*.25+t*.075)*p;
    float r = max(length(p), .005);
    float a = atan(p.y,p.x);
    float z = 1.1/r + t*(3.8+.18*t);
    float sides = 8.;
    float sector = abs(fract(a/(2.*PI)*sides+.5)-.5);
    float facet = cos(PI/sides)/cos((sector-.25)*2.*PI/sides);
    float depth = z*facet;
    float ring = pow(max(0.,1.-abs(fract(depth*.30)-.5)*2.),32.);
    float rail = pow(max(0.,1.-sector*2.),70.);
    float detail = pow(max(0.,1.-abs(fract(depth*1.2)-.5)*2.),45.);
    float fade = smoothstep(.01,.18,r)*(1.-smoothstep(1.2,2.,r));
    float lanes = hash(vec2(floor(a*24.),floor(depth*.18)));
    float streaks = pow(.5+.5*sin(a*150.+sin(a*37.)*3.),24.) * pow(.5+.5*sin(depth*.7+a*12.),8.);
    vec3 col = gold((ring*.58 + rail*.55+detail*.065 + streaks*.75)*fade);
    col += vec3(.12,.19,.26)*rail*.25*fade;
    col += gold(.007/(r*r+.015))*(.4+uPulse*.15);
    col += gold(lanes*ring*.2);
    return col;
  }
  vec3 finale(vec2 p) {
    float t = uTime-22.5;
    if (t < .9375) {
      float r = length(p);
      return gold(.00015/(r*r+.0003))*(1.-smoothstep(.5,.9,t));
    }
    float e = t-.9375;
    float r = length(p);
    float a = atan(p.y,p.x);
    float radius = .18 + (1.-exp(-e*1.6))*.38;
    float halo = .009/(abs(r-radius)+.012);
    float waves = sin(a*34.+r*21.-e*2.)*sin(a*19.-r*35.+e);
    float corona = exp(-abs(r-radius-waves*.021)*34.)*(.5+.5*fbm(p*14.+e*.12));
    float filaments = pow(.5+.5*sin(a*220.+fbm(p*7.)*6.+e),9.)*exp(-abs(r-radius)*9.);
    vec3 col = gold(halo*.3+corona*.42+filaments*.22);
    col += gold(exp(-r*4.)*.08);
    return col;
  }
  void main() {
    vec2 p = (vUv-.5)*vec2(uResolution.x/uResolution.y,1.)*2.;
    vec3 col = vec3(.0015,.002,.003);
    col += stars(p)*.7;
    if (uTime < 7.5) { col += blackhole(p); }
    else if (uTime < 15.) {
      col += gold(.017/(length(p-vec2(.4,0.))+.12));
      float line = pow(.5+.5*sin(p.y*90.+p.x*6.+uTime*.2),28.);
      col += vec3(.045,.028,.012)*line*exp(-length(p)*1.4);
    }
    else if (uTime < 22.5) { col += tunnel(p); }
    else { col += finale(p); }
    float vignette = 1.-smoothstep(.4,1.9,length(p));
    col *= .55+.45*vignette;
    gl_FragColor = vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export const particleVertex = /* glsl */`
  uniform float uTime;
  uniform float uPulse;
  uniform float uHeight;
  attribute vec3 aSeed;
  attribute vec3 aGlyph;
  varying float vAlpha;
  varying float vHeat;
  const float PI = 3.14159265359;
  void main() {
    float t = uTime;
    float a = aSeed.x*PI*2.;
    float b = aSeed.y*PI*2.;
    vec3 p;
    float alpha = 1.;
    if (t < 7.5) {
      float r = 1.45+aSeed.y*4.3;
      float spin = a+t*(.12+.8/(r*r));
      p = vec3(cos(spin)*r,sin(b*7.+t)*.035,sin(spin)*r);
      alpha = smoothstep(1.5,5.5,t)*.6;
    } else if (t < 15.) {
      float r = 2.5+aSeed.z*2.5;
      float phi = acos(2.*aSeed.y-1.);
      p = vec3(sin(phi)*cos(a+t*.08),cos(phi),sin(phi)*sin(a+t*.08))*r;
      alpha = .38;
    } else if (t < 22.5) {
      float speed = (t-15.)*12.;
      float z = mod(aSeed.z*60.+speed,60.)-30.;
      p = vec3(cos(a)*(2.+aSeed.y*7.),sin(a)*(2.+aSeed.y*7.),z);
      alpha = .5;
    } else {
      float e = max(0.,t-23.4375);
      float r = (1.-exp(-e*1.8))*(1.7+aSeed.z*4.8);
      float phi = acos(2.*aSeed.y-1.);
      float spin = a + e*.075 + aSeed.z*.35;
      p = vec3(sin(phi)*cos(spin),cos(phi),sin(phi)*sin(spin))*r;
      p *= vec3(1.,.72,1.);
      alpha = step(23.4375,t)*(.55+.45*exp(-e));
      float morph = smoothstep(25.5+aSeed.z*.38,27.30,t);
      p = mix(p,aGlyph,morph);
      alpha *= 1.-smoothstep(28.15,29.4,t)*.9;
    }
    vec4 mv = modelViewMatrix*vec4(p,1.);
    gl_Position = projectionMatrix*mv;
    gl_PointSize = min(5.,(.6+aSeed.z*1.4)*(uHeight/1080.)*7./max(1.,-mv.z));
    vAlpha = alpha*(.3+.7*aSeed.z);
    vHeat = aSeed.z;
  }
`

export const particleFragment = /* glsl */`
  varying float vAlpha;
  varying float vHeat;
  void main() {
    float d = length(gl_PointCoord-.5)*2.;
    if (d>1.) discard;
    vec3 color = mix(vec3(1.,.32,.045),vec3(1.,.87,.63),vHeat);
    gl_FragColor = vec4(color,pow(1.-d,1.5)*vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export const finishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 0 } },
  vertexShader: screenVertex,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      vec2 dir = (vUv-.5)*uAmount;
      vec3 col;
      col.r = texture2D(tDiffuse,vUv+dir).r;
      col.g = texture2D(tDiffuse,vUv).g;
      col.b = texture2D(tDiffuse,vUv-dir).b;
      float grain = fract(sin(dot(vUv*vec2(1920.,1080.)+fract(uTime)*11.,vec2(12.9898,78.233)))*43758.5453);
      col += (grain-.5)*.012;
      gl_FragColor = vec4(max(col,0.),1.);
    }
  `,
}
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// The main render's depth texture includes alpha-tested characters, grass and props.
// No overrideMaterial depth pass: transparent atlas margins do NOT become solid cards.
export function createWesternPostFX(renderer, width, height) {
  const hdr = renderer.extensions.has('EXT_color_buffer_float');
  const type = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const target = new THREE.WebGLRenderTarget(width, height, {
    type, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    depthBuffer: true, stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;
  target.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
  target.depthTexture.format = THREE.DepthFormat;
  target.depthTexture.minFilter = target.depthTexture.magFilter = THREE.NearestFilter;
  const glowA = new THREE.WebGLRenderTarget(Math.max(1, width >> 2), Math.max(1, height >> 2), {
    type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  glowA.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const glowB = glowA.clone();
  const blur = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: {
      source: {value: target.texture}, stepUV: {value: new THREE.Vector2(1 / width, 0)},
      extract: {value: 1}, threshold: {value: hdr ? 1.0 : .72},
    },
    vertexShader,
    fragmentShader: `
      varying vec2 vUv; uniform sampler2D source;
      uniform vec2 stepUV; uniform float extract, threshold;
      vec3 tap(vec2 uv) {
        vec3 c = texture2D(source, clamp(uv, vec2(.001), vec2(.999))).rgb;
        float l = max(c.r, max(c.g, c.b));
        return mix(c, c * max(0.0, l-threshold)/max(l, .0001), extract);
      }
      void main() {
        vec3 c = tap(vUv)*.227027;
        c += (tap(vUv+stepUV*1.384615)+tap(vUv-stepUV*1.384615))*.316216;
        c += (tap(vUv+stepUV*3.230769)+tap(vUv-stepUV*3.230769))*.070270;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const finalMaterial = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: {
      image: {value: target.texture}, depthImage: {value: target.depthTexture}, glow: {value: glowB.texture},
      pixel: {value: new THREE.Vector2(1 / width, 1 / height)},
      nearPlane: {value: .1}, farPlane: {value: 320}, focus: {value: 15},
      aperture: {value: 1}, exposure: {value: 1.04}, bloom: {value: .105},
      shadowTint: {value: new THREE.Color('#bdcbd0')}, fade: {value: 1},
    },
    vertexShader,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D image, depthImage, glow;
      uniform vec2 pixel;
      uniform float nearPlane, farPlane, focus, aperture, exposure, bloom, fade;
      uniform vec3 shadowTint;
      float linearDepth(vec2 uv) {
        float d = texture2D(depthImage, uv).x;
        return nearPlane*farPlane / max(.00001, farPlane-d*(farPlane-nearPlane));
      }
      float coc(float d) {
        // A generous in-focus shelf protects the entire face/torso, not just one pixel plane.
        float relative = abs(d-focus) / max(focus, .1);
        return smoothstep(.10, .65, relative) * (d < focus ? 7.5 : 6.0) * aperture;
      }
      vec3 film(vec3 x) {
        return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0.0, 1.0);
      }
      void main() {
        float d = linearDepth(vUv), radius = coc(d);
        vec3 original = texture2D(image, vUv).rgb;
        vec3 sum = original * 2.0; float total = 2.0;
        if (radius > .2) {
          for (int i=0; i<16; i++) {
            float a = float(i)*2.39996323;
            float r = sqrt((float(i)+.5)/16.0)*radius;
            vec2 uv = clamp(vUv+vec2(cos(a),sin(a))*r*pixel, pixel*.5, 1.0-pixel*.5);
            float sd = linearDepth(uv);
            // Reject cross-depth samples so distant scenery cannot bleed into pixel faces.
            float weight = exp(-abs(sd-d)/max(.24, d*.055));
            sum += texture2D(image, uv).rgb*weight; total += weight;
          }
        }
        vec3 c = sum/total + min(texture2D(glow, vUv).rgb, vec3(2.0))*bloom;
        float luminance = dot(c, vec3(.2126,.7152,.0722));
        c = mix(c*shadowTint, c, smoothstep(.02,.5,luminance));
        c = mix(vec3(luminance), c, 1.02);
        c = film(c*exposure);
        vec2 p = vUv*2.0-1.0;
        c *= 1.0-.10*smoothstep(.38,1.45,dot(p,p));
        // Fixed film grain: no temporal noise and no unseeded random state.
        float grain = fract(sin(dot(floor(vUv/pixel),vec2(12.9898,78.233)))*43758.5453)-.5;
        c = max(vec3(0.0), c+grain*.0022)*fade;
        gl_FragColor = vec4(c,1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(geometry, blur); quad.frustumCulled = false; scene.add(quad);
  let disposed = false;

  return {
    render(worldScene, worldCamera, settings = {}) {
      if (disposed) throw new Error('HD-2D 后期资源已释放。');
      // Render linear lighting to the scene target; film curve and sRGB run exactly once below.
      renderer.setRenderTarget(target); renderer.render(worldScene, worldCamera);
      quad.material = blur;
      blur.uniforms.source.value = target.texture; blur.uniforms.extract.value = 1;
      blur.uniforms.stepUV.value.set(4 / target.width, 0);
      renderer.setRenderTarget(glowA); renderer.render(scene, camera);
      blur.uniforms.source.value = glowA.texture; blur.uniforms.extract.value = 0;
      blur.uniforms.stepUV.value.set(0, 1 / glowA.height);
      renderer.setRenderTarget(glowB); renderer.render(scene, camera);
      const u = finalMaterial.uniforms;
      u.nearPlane.value = worldCamera.near; u.farPlane.value = worldCamera.far;
      u.focus.value = settings.focus ?? 15; u.aperture.value = settings.aperture ?? 1;
      u.exposure.value = settings.exposure ?? 1.04; u.fade.value = settings.fade ?? 1;
      u.bloom.value = settings.bloom ?? .105;
      quad.material = finalMaterial;
      renderer.setRenderTarget(null); renderer.render(scene, camera);
    },
    resize(w, h) {
      target.setSize(w, h); glowA.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
      glowB.setSize(glowA.width, glowA.height); finalMaterial.uniforms.pixel.value.set(1 / w, 1 / h);
    },
    info: () => ({enabled: !disposed, hdr, depthBasedDOF: true, alphaTestDepth: true, temporalHistory: false, geometryCount: 1}),
    dispose() {
      if (disposed) return; disposed = true;
      target.dispose(); glowA.dispose(); glowB.dispose();
      geometry.dispose(); blur.dispose(); finalMaterial.dispose();
    },
  };
}
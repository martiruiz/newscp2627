// Sign-up / log-in background: a slow ribbon of light (violet → SCP gold) waving across the navy page, drawn with a
// tiny WebGL shader. Falls back to the CSS gradient when WebGL isn't available; still frame with "reduce motion".
(() => {
  const host = document.querySelector(".auth-page");
  if (!host) return;
  const c = document.createElement("canvas");
  c.className = "auth-bg"; c.setAttribute("aria-hidden", "true");
  host.prepend(c);
  const gl = c.getContext("webgl", { antialias: false, premultipliedAlpha: false });
  if (!gl) { c.remove(); return; }
  const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
  const fs = `precision highp float;
  uniform vec2 r; uniform float t; uniform float light;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
  void main(){
    vec2 uv = gl_FragCoord.xy / r; float ar = r.x / r.y; vec2 q = vec2(uv.x * ar, uv.y);
    float s = t * .11;
    // the ribbon: a diagonal band that bends like silk
    float center = .62 - .55 * uv.x + .10 * sin(uv.x * 2.6 + s * 1.3) + .05 * sin(uv.x * 6.1 - s * 1.7) + .06 * (noise(q * 1.4 + s * .4) - .5);
    float d = uv.y - center;
    float w = .09 + .05 * sin(uv.x * 3.1 - s);
    float core = exp(-pow(d / w, 2.));
    float halo = exp(-pow(d / (w * 3.2), 2.)) * .35;
    float folds = .55 + .45 * sin((uv.x * 9. + d * 22.) - s * 2.2);      // light running along the folds
    float glow = core * (.55 + .45 * folds) + halo;
    vec3 navy = mix(vec3(.027, .043, .09), vec3(.07, .10, .2), uv.y * .6);
    vec3 violet = vec3(.48, .36, 1.), gold = vec3(.94, .72, .29);
    vec3 col = mix(violet, gold, smoothstep(.15, 1.05, uv.x + .25 * sin(s * .7)));
    vec3 o = navy + col * glow * .62;
    o += (hash(gl_FragCoord.xy + t) - .5) / 255. * 2.;               // dither: no banding
    if (light > .5) o = mix(vec3(.96, .97, .99), o, .28 + glow * .25);
    gl_FragColor = vec4(o, 1.);
  }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { c.remove(); return; }
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(pr, "r"), uT = gl.getUniformLocation(pr, "t"), uL = gl.getUniformLocation(pr, "light");
  const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.75;    // soft light doesn't need full resolution
  const size = () => { c.width = Math.round(innerWidth * scale); c.height = Math.round(innerHeight * scale); gl.viewport(0, 0, c.width, c.height); };
  size(); addEventListener("resize", size);
  const isLight = () => document.documentElement.dataset.theme === "light" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: light)").matches);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const t0 = performance.now() - 40000;
  const draw = () => {
    gl.uniform2f(uR, c.width, c.height); gl.uniform1f(uT, (performance.now() - t0) / 1000); gl.uniform1f(uL, isLight() ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!still && !document.hidden) requestAnimationFrame(draw);
  };
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !still) requestAnimationFrame(draw); });
  draw();
  requestAnimationFrame(() => c.classList.add("is-on"));
})();

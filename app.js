/*
 * Ryou Koshimizu — portfolio
 *
 * 1. なめらかなスクロール：中身（#scroller）を固定の箱にして、毎フレーム JS が動かす。
 *    ガラスを描くキャンバスと文字が同じフレームで動くので、ガラスが文字から遅れない。
 * 2. 動き：出てくる動き・数字のカウント・ナビのレンズ（バネ）・磁石のボタン・進め方の線。
 * 3. ガラス（WebGL）：背景（空・光る玉・大きな文字）を一度テクスチャに描き、
 *    [data-glass] の要素の位置に、角の丸い厚いガラスとして重ねる。
 *    縁で光が曲がる（屈折）・色が少し分かれる（分散）・すりガラス（ぼかし）・縁の光（光源はポインタ）。
 *    ヒーローの丸いレンズは名前の文字を拡大して曲げ、スクロールするとナビのレンズへ溶けて合わさる。
 */
(function () {
  'use strict';

  /* ---- 調整用の値（実機で振って決める） ---- */
  var CONFIG = {
    dprMax: 2,            // パソコンの描画解像度の上限
    dprMobile: 1.5,       // スマホ
    scrollEase: 11,       // スクロールの追従（大きいほど速い）
    panel: { refract: 26, mag: 0.035, tint: 0.05, dark: 0.66, frost: 0.9 },
    lens: { refract: 0.32, mag: 0.22, tint: 0.03, dark: 1.04, disp: 0.07 },
    navLens: { refract: 16, mag: 0.12, tint: 0.07, dark: 1.0, frost: 0.15 },
    blurSpread: [1.6, 3.2] // すりガラスのぼかし（2回）
  };

  var html = document.documentElement;
  html.classList.remove('no-js');
  html.classList.add('js');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var mobile = coarse || window.matchMedia('(max-width: 760px)').matches;

  var S = { cur: window.scrollY, vw: innerWidth, vh: innerHeight };
  var hooks = [];

  /* ======================================================================
   * 1. なめらかなスクロール
   * ==================================================================== */
  var scroller = document.getElementById('track');
  html.classList.add('smooth');
  function fitHeight() { document.body.style.height = scroller.offsetHeight + 'px'; }
  if (window.ResizeObserver) new ResizeObserver(fitHeight).observe(scroller);
  fitHeight();

  function scrollToEl(el) {
    var y = el ? el.getBoundingClientRect().top + S.cur - 96 : 0;
    window.scrollTo(0, Math.max(0, y));
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var el = id === 'top' ? null : document.getElementById(id);
    if (id !== 'top' && !el) return;
    e.preventDefault();
    scrollToEl(el);
    history.replaceState(null, '', '#' + id);
  });
  document.addEventListener('focusin', function (e) {
    var r = e.target.getBoundingClientRect();
    if (r.top < 90 || r.bottom > innerHeight - 20) window.scrollTo(0, Math.max(0, r.top + S.cur - innerHeight / 3));
  });
  if (location.hash.length > 1) {
    var start = document.getElementById(location.hash.slice(1));
    if (start) requestAnimationFrame(function () { scrollToEl(start); S.cur = window.scrollY; });
  }

  /* ======================================================================
   * 2. 動き
   * ==================================================================== */
  // 出てくる動き（同じ段の物は少しずつずらす）
  var revealIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      revealIO.unobserve(e.target);
      e.target.querySelectorAll('.num').forEach(countUp);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  document.querySelectorAll('[data-reveal]').forEach(function (el) {
    var sib = el.parentElement ? Array.prototype.filter.call(el.parentElement.children, function (c) { return c.hasAttribute('data-reveal'); }) : [];
    el.style.setProperty('--i', String(Math.max(0, sib.indexOf(el))));
    revealIO.observe(el);
  });

  function fmt(n, dec) { return dec ? n.toFixed(dec) : Math.round(n).toLocaleString('ja-JP'); }
  function countUp(el) {
    var to = el.getAttribute('data-to');
    var v = parseFloat(to);
    var dec = (to.split('.')[1] || '').length;
    if (reduced || !v) { el.textContent = fmt(v, dec); return; }
    var t0 = performance.now() + 120;
    el.textContent = (0).toFixed(dec);
    (function step(now) {
      var p = Math.max(0, Math.min(1, (now - t0) / 1500));
      var e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = fmt(v * e, dec);
      if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(v, dec);
    })(performance.now());
  }

  // 最初の表示
  requestAnimationFrame(function () {
    html.classList.add('ready');
    setTimeout(function () { document.querySelectorAll('.cta .btn').forEach(function (b) { b.classList.add('settled'); }); }, 1800);
  });

  // 磁石のボタン：近づくとポインタへ寄り、離れるとバネで戻る
  document.querySelectorAll('[data-magnetic]').forEach(function (b) {
    if (coarse || reduced) return;
    b.addEventListener('pointermove', function (e) {
      var r = b.getBoundingClientRect();
      var x = (e.clientX - r.left - r.width / 2) * 0.22;
      var y = (e.clientY - r.top - r.height / 2) * 0.32;
      b.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(1.04)';
    });
    b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    b.addEventListener('pointerdown', function () { b.style.transform = 'scale(.94)'; });
    b.addEventListener('pointerup', function () { b.style.transform = 'scale(1.04)'; });
  });

  // カード：押すと少し沈み、バネで戻る
  document.querySelectorAll('.card, .step').forEach(function (c) {
    if (reduced) return;
    c.addEventListener('pointerdown', function (e) { if (!e.target.closest('a')) c.style.transform = 'scale(.975)'; });
    var up = function () { c.style.transform = ''; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointerleave', up);
  });

  // ポインタ（光源とレンズの行き先）
  var ptr = { x: innerWidth * 0.62, y: innerHeight * 0.3, has: false, last: 0 };
  var light = { x: innerWidth * 0.2, y: innerHeight * 0.1 };
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.has = true; ptr.last = performance.now();
  }, { passive: true });
  var ripple = { x: 0, y: 0, t0: -1e9 };
  window.addEventListener('pointerdown', function (e) {
    ripple.x = e.clientX; ripple.y = e.clientY; ripple.t0 = performance.now();
    if (e.pointerType === 'touch') { ptr.x = e.clientX; ptr.y = e.clientY; ptr.last = performance.now(); }
  }, { passive: true });

  // ナビのレンズ（今いる段の下にバネで動き、動く間は横に伸びる）
  var navEl = document.querySelector('.nav');
  var navLens = navEl.querySelector('.nav-lens');
  var links = Array.prototype.slice.call(navEl.querySelectorAll('.nav-links a'));
  var sections = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var NL = { x: 0, w: 0, vx: 0, vw: 0, init: false, alpha: 0 };

  // ヒーローのレンズ（ポインタへバネで向かい、しずくが遅れてついてくる）
  var hero = document.getElementById('top');
  var nameEl = hero.querySelector('.name');
  var L = { x: innerWidth * 0.62, y: -260, vx: 0, vy: 0, dx: innerWidth * 0.62, dy: -420, dvx: 0, dvy: 0,
            r: 0, out: { x: 0, y: 0, r: 0, dx: 0, dy: 0, dr: 0, alpha: 0, sx: 1, sy: 0, s: 0, merge: false, mk: 0 } };
  var dock = 0;

  function updateMotion(dt, now) {
    // 今いる段
    var mark = innerHeight * 0.45;
    var idx = -1;
    for (var i = 0; i < sections.length; i++) if (sections[i] && sections[i].getBoundingClientRect().top < mark) idx = i;
    for (var j = 0; j < links.length; j++) links[j].classList.toggle('on', j === idx);

    // ヒーローからナビへ（0 → 1）
    var heroH = hero.offsetHeight;
    var p = Math.min(1, Math.max(0, S.cur / (heroH * 0.5)));
    dock = p * p * (3 - 2 * p);

    // ナビのレンズ
    var a = links[Math.max(idx, 0)];
    var tx = a.offsetLeft, tw = a.offsetWidth;
    if (!NL.init) { NL.x = tx; NL.w = tw; NL.init = true; }
    if (reduced) { NL.x = tx; NL.w = tw; NL.vx = 0; }
    else {
      NL.vx += (300 * (tx - NL.x) - 28 * NL.vx) * dt; NL.x += NL.vx * dt;
      NL.vw += (300 * (tw - NL.w) - 28 * NL.vw) * dt; NL.w += NL.vw * dt;
    }
    var st = Math.min(Math.abs(NL.vx) / 1600, 0.38);
    NL.alpha = idx >= 0 ? 1 : smooth(0.55, 0.95, dock);
    navLens.style.width = NL.w.toFixed(1) + 'px';
    navLens.style.transform = 'translateX(' + NL.x.toFixed(1) + 'px) scale(' + (1 + st).toFixed(3) + ',' + (1 - st * 0.42).toFixed(3) + ')';
    navLens.style.opacity = NL.alpha.toFixed(3);

    // 光源：ポインタへゆっくり。ポインタがなければ左上をゆっくり回る
    var lx = ptr.has ? ptr.x : innerWidth * (0.3 + 0.2 * Math.sin(now / 4200));
    var ly = ptr.has ? ptr.y : innerHeight * (0.12 + 0.08 * Math.cos(now / 5100));
    var lk = 1 - Math.exp(-dt * 6);
    light.x += (lx - light.x) * lk; light.y += (ly - light.y) * lk;

    // ヒーローのレンズ
    var nr = nameEl.getBoundingClientRect();
    var rBase = Math.max(54, Math.min(156, Math.min(innerWidth, innerHeight) * 0.15));
    var idle = coarse || !ptr.has || now - ptr.last > 2600;
    var gx, gy;
    if (reduced) { gx = nr.left + nr.width * 0.62; gy = nr.top + nr.height * 0.68; }
    else if (idle) {
      var t = now / 1000;
      gx = nr.left + nr.width * (0.5 + 0.36 * Math.sin(t * 0.37));
      gy = nr.top + nr.height * (0.5 + 0.3 * Math.sin(t * 0.61 + 1.3));
    } else { gx = ptr.x; gy = ptr.y; }
    if (reduced) { L.x = gx; L.y = gy; L.vx = L.vy = 0; L.dx = gx; L.dy = gy; }
    else {
      L.vx += (110 * (gx - L.x) - 13 * L.vx) * dt; L.x += L.vx * dt;
      L.vy += (110 * (gy - L.y) - 13 * L.vy) * dt; L.y += L.vy * dt;
      L.dvx += (38 * (L.x - L.dx) - 6.5 * L.dvx) * dt; L.dx += L.dvx * dt;
      L.dvy += (38 * (L.y - L.dy) - 6.5 * L.dvy) * dt; L.dy += L.dvy * dt;
    }
    var lr = navLens.getBoundingClientRect();
    var cx = lr.left + lr.width / 2, cy = lr.top + lr.height / 2;
    var e2 = dock * dock;
    var o = L.out;
    o.r = rBase + (lr.height / 2 - rBase) * dock;
    o.x = L.x + (cx - L.x) * e2;
    o.y = L.y + (cy - L.y) * e2;
    o.dx = L.dx + (cx - L.dx) * e2;
    o.dy = L.dy + (cy - L.dy) * e2;
    o.dr = o.r * 0.3 * (1 - dock);
    var speed = Math.sqrt(L.vx * L.vx + L.vy * L.vy);
    o.s = Math.min(speed * (1 - dock) / 2600, 0.42);
    o.sx = speed > 1 ? L.vx / speed : 1;
    o.sy = speed > 1 ? L.vy / speed : 0;
    o.alpha = dock >= 0.995 ? 0 : 1;
    o.merge = dock > 0.02 && dock < 0.995;
    o.mk = 26 * (1 - dock);

    // 進め方の線
    var stepsEl = document.querySelector('.steps');
    if (stepsEl) {
      var sr = stepsEl.getBoundingClientRect();
      var pr = Math.min(1, Math.max(0, (innerHeight * 0.85 - sr.top) / (sr.height + innerHeight * 0.25)));
      stepsEl.style.setProperty('--draw', reduced ? '1' : pr.toFixed(3));
    }
  }

  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /* ======================================================================
   * 3. ガラス（WebGL）
   * ==================================================================== */
  var GL = initGL();

  /* ---- 毎フレーム ---- */
  var last = performance.now();
  var slow = 0;
  function frame(now) {
    var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    var target = window.scrollY;
    var k = reduced ? 1 : 1 - Math.exp(-dt * CONFIG.scrollEase);
    S.cur += (target - S.cur) * k;
    if (Math.abs(target - S.cur) < 0.05) S.cur = target;
    scroller.style.transform = 'translate3d(0,' + (-S.cur).toFixed(2) + 'px,0)';
    updateMotion(dt, now);
    if (GL) {
      GL.render(now);
      // 重い端末では解像度を下げる
      if (dt > 0.024) slow++; else slow = Math.max(0, slow - 1);
      if (slow > 50) { slow = 0; GL.lower(); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function initGL() {
    var canvas = document.getElementById('gl');
    var gl;
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
    } catch (err) { gl = null; }
    if (!gl) return null;

    var D = Math.min(window.devicePixelRatio || 1, mobile ? CONFIG.dprMobile : CONFIG.dprMax);
    var W = 0, H = 0, BW = 0, BH = 0;
    var MAXTEX = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    var OCT = mobile ? 3 : 4;

    var VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';

    var NOISE = [
      'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
      'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
      'return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}',
      'float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);',
      'for(int i=0;i<' + OCT + ';i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}'
    ].join('\n');

    // 背景：空・大きな文字・光る玉・名前
    var FS_SCENE = [
      'precision highp float;',
      'uniform vec2 uRes;uniform float uT;uniform float uDpr;',
      'uniform vec4 uOrb[6];uniform vec3 uOrbC[6];',
      'uniform sampler2D uTxt;uniform vec4 uTR[8];uniform vec4 uTU[8];uniform vec4 uTA[8];uniform float uTn;',
      NOISE,
      'vec3 sky(vec2 fc){',
      ' vec2 uv=fc/uRes;float asp=uRes.x/uRes.y;vec2 p=vec2(uv.x*asp,uv.y);float t=uT;',
      ' vec2 q=vec2(fbm(p*1.3+vec2(0.,t*.035)),fbm(p*1.3+vec2(5.2,1.3-t*.03)));',
      ' vec2 w=p+.5*(q-.5);',
      ' vec3 c=vec3(.010,.012,.028);',
      ' vec2 a=w-vec2(asp*.10,.98);c+=vec3(.18,.30,1.)*.42*exp(-dot(a,a)/.20);',
      ' vec2 b=w-vec2(asp*.95,.66);c+=vec3(.52,.26,1.)*.34*exp(-dot(b,b)/.13);',
      ' vec2 d=w-vec2(asp*.52,-.05);c+=vec3(.08,.78,.76)*.20*exp(-dot(d,d)/.10);',
      ' float r=smoothstep(.56,.92,fbm(w*2.6+t*.02));c+=r*.03*vec3(.6,.7,1.);',
      ' return c;}',
      'float txt(vec4 R,vec4 U,vec4 A,vec2 fc,out float lpy){',
      ' vec2 lp=(fc-R.xy)/R.zw;lpy=lp.y;',
      ' if(lp.x<0.||lp.y<0.||lp.x>1.||lp.y>1.)return 0.;',
      ' float rv=A.y;',
      ' float m=1.-smoothstep(rv*1.35-.35,rv*1.35,lp.x);',
      ' float a=texture2D(uTxt,vec2(U.x+lp.x*U.z,U.y+(1.-lp.y)*U.w)).a;',
      ' return a*m*A.x;}',
      'void main(){',
      ' vec2 fc=gl_FragCoord.xy;vec3 c=sky(fc);float py;',
      ' for(int i=0;i<8;i++){if(float(i)>=uTn)break;if(uTA[i].z>.5){float a=txt(uTR[i],uTU[i],uTA[i],fc,py);c+=vec3(.78,.84,1.)*a;}}',
      ' for(int i=0;i<6;i++){',
      '  vec4 O=uOrb[i];if(O.z<1.)continue;vec3 col=uOrbC[i];',
      '  vec2 d=(fc-O.xy)/O.z;float r2=dot(d,d);float l=sqrt(r2);',
      '  c+=col*.20*exp(-max(l-1.,0.)*2.6);',
      '  if(l<1.02){',
      '   vec3 n=vec3(d,sqrt(max(1.-r2,0.)));vec3 Lg=normalize(vec3(-.5,.62,.62));',
      '   float dif=max(dot(n,Lg),0.);float sp=pow(max(dot(reflect(-Lg,n),vec3(0.,0.,1.)),0.),36.);',
      '   float fr=pow(1.-n.z,2.6);',
      '   vec3 iri=.5+.5*cos(6.2831*(fr*.7+vec3(0.,.33,.67))+uT*.25+float(i));',
      '   vec3 s=mix(col*.10,col*1.05,dif)+sp*.95+fr*mix(col,iri,.55)*.75+col*.18*max(-n.y,0.);',
      '   c=mix(c,s,1.-smoothstep(1.-2.2/O.z,1.,l));}',
      ' }',
      ' for(int i=0;i<8;i++){if(float(i)>=uTn)break;if(uTA[i].z<.5){float a=txt(uTR[i],uTU[i],uTA[i],fc,py);',
      '  vec3 tc=mix(vec3(.80,.85,1.),vec3(1.),smoothstep(.15,.85,py));c=mix(c,tc,a);}}',
      ' gl_FragColor=vec4(c,1.);}'
    ].join('\n');

    var FS_COPY = [
      'precision mediump float;varying vec2 v;uniform sampler2D uTex;uniform vec2 uPx;',
      'void main(){vec3 c=texture2D(uTex,v+uPx*vec2(-1.,-1.)).rgb+texture2D(uTex,v+uPx*vec2(1.,-1.)).rgb',
      '+texture2D(uTex,v+uPx*vec2(-1.,1.)).rgb+texture2D(uTex,v+uPx*vec2(1.,1.)).rgb;gl_FragColor=vec4(c*.25,1.);}'
    ].join('\n');

    var FS_BLUR = [
      'precision mediump float;varying vec2 v;uniform sampler2D uTex;uniform vec2 uDir;',
      'void main(){vec3 c=texture2D(uTex,v).rgb*.227027;',
      'c+=(texture2D(uTex,v+uDir*1.3846).rgb+texture2D(uTex,v-uDir*1.3846).rgb)*.316216;',
      'c+=(texture2D(uTex,v+uDir*3.2308).rgb+texture2D(uTex,v-uDir*3.2308).rgb)*.070270;',
      'gl_FragColor=vec4(c,1.);}'
    ].join('\n');

    // 仕上げ：影 → ガラス → レンズ → 周辺減光と粒
    var FS_COMP = [
      'precision highp float;',
      'uniform sampler2D uScene;uniform sampler2D uBlur;uniform vec2 uRes;uniform float uDpr;uniform float uT;',
      'uniform vec4 uS[16];uniform vec4 uP[16];uniform vec4 uQ[16];uniform vec3 uC[16];uniform float uN;',
      'uniform vec4 uLens;uniform vec4 uDrop;uniform vec3 uLv;uniform float uMerge;uniform float uMk;',
      'uniform vec2 uLight;uniform vec4 uRip;',
      'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
      'float sdRR(vec2 p,vec2 b,float r){r=min(r,min(b.x,b.y));vec2 q=abs(p)-b+r;return min(max(q.x,q.y),0.)+length(max(q,0.))-r;}',
      'float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}',
      'float sdLens(vec2 p){',
      ' vec2 q=p-uLens.xy;vec2 dir=uLv.xy;float s=uLv.z;',
      ' vec2 qr=vec2(dot(q,dir),dot(q,vec2(-dir.y,dir.x)));',
      ' qr=vec2(qr.x/(1.+s),qr.y*(1.+s*.55));',
      ' float d1=length(qr)-uLens.z;',
      ' float d2=length(p-uDrop.xy)-uDrop.z;',
      ' return uDrop.z>.5?smin(d1,d2,max(uLens.z*.55,1.)):d1;}',
      'vec2 ripple(vec2 fc){',
      ' if(uRip.w<=0.)return fc;',
      ' vec2 d=fc-uRip.xy;float l=length(d)+1e-3;float ring=(l-uRip.z)/(46.*uDpr);',
      ' return fc-d/l*exp(-ring*ring)*uRip.w*16.*uDpr;}',
      'vec3 sceneAt(vec2 px){return texture2D(uScene,clamp(px/uRes,vec2(.0005),vec2(.9995))).rgb;}',
      'vec3 blurAt(vec2 px){return texture2D(uBlur,clamp(px/uRes,vec2(.0005),vec2(.9995))).rgb;}',
      'float sdShape(vec2 p,vec4 S,float r,float m){float d=sdRR(p-S.xy,S.zw,r);if(m>.5)d=smin(d,sdLens(p),uMk);return d;}',
      'vec3 glass(vec2 fc,vec2 c,float d,vec2 nr,float bevel,float frost,float refr,float mag,float tint,float dark,vec3 tc,float dk){',
      ' float k=1.-clamp(-d/bevel,0.,1.);float k2=k*k;',
      // 縁ほど強く曲がる（厚いガラスの面取り）。外側の物が縁の内側に回り込んで見える
      ' float bend=(.25*k+.75*k2*k)*refr;',
      ' vec2 base=ripple(c+(fc-c)*(1.-mag));vec2 o=nr*bend;',
      ' float disp=dk*(.25+.75*k2);',
      ' vec3 g=vec3(sceneAt(base+o*(1.+disp)).r,sceneAt(base+o).g,sceneAt(base+o*(1.-disp)).b);',
      ' if(frost>.01){vec3 bl=vec3(blurAt(base+o*(1.+disp)).r,blurAt(base+o).g,blurAt(base+o*(1.-disp)).b);g=mix(g,bl,frost);}',
      ' float lum=dot(g,vec3(.299,.587,.114));g=mix(vec3(lum),g,1.35);',
      ' g=g*dark+tint*tc;',
      ' vec2 Ld=normalize(uLight-c+vec2(.001));',
      ' float f=max(dot(nr,Ld),0.);float b=max(dot(nr,-Ld),0.);',
      ' float edge=smoothstep(.2,1.,k);',
      ' g+=pow(f,3.)*edge*.34+pow(b,3.)*edge*.12;',
      ' g+=k2*k2*.06;',
      ' g+=.07*pow(max(dot(normalize(fc-c+vec2(.001)),Ld),0.),2.)*smoothstep(.0,.9,k);',
      ' float rim=smoothstep(-2.4*uDpr,-.5*uDpr,d);',
      ' g+=rim*(.06+.62*pow(f,2.)+.26*pow(b,2.));',
      // 光の反対側の内側を少し暗く（厚み）
      ' g*=1.-.18*smoothstep(.3,.9,k)*pow(b,1.5);',
      ' return g;}',
      'void main(){',
      ' vec2 fc=gl_FragCoord.xy;',
      ' vec3 c=sceneAt(ripple(fc));',
      ' float sh=0.;',
      ' for(int i=0;i<16;i++){if(float(i)>=uN)break;vec4 S=uS[i];vec4 P=uP[i];',
      '  float ds=sdRR(fc-S.xy+vec2(0.,16.*uDpr),S.zw,P.x);',
      '  sh=max(sh,P.w*.5*(1.-smoothstep(-14.*uDpr,48.*uDpr,ds)));}',
      ' if(uLens.w>0.&&uMerge<0.){float dl=sdLens(fc+vec2(0.,20.*uDpr));sh=max(sh,uLens.w*.55*(1.-smoothstep(-16.*uDpr,60.*uDpr,dl)));}',
      ' c*=1.-sh;',
      ' vec2 e=vec2(1.,0.);',
      ' for(int i=0;i<16;i++){if(float(i)>=uN)break;',
      '  vec4 S=uS[i];vec4 P=uP[i];vec4 Q=uQ[i];',
      '  float m=abs(float(i)-uMerge)<.5?1.:0.;',
      '  vec2 q=fc-S.xy;',
      '  if(m<.5&&(abs(q.x)>S.z+2.||abs(q.y)>S.w+2.))continue;',
      '  float d=sdShape(fc,S,P.x,m);',
      '  if(d<1.){',
      '   vec2 nr=normalize(vec2(sdShape(fc+e.xy,S,P.x,m)-sdShape(fc-e.xy,S,P.x,m),sdShape(fc+e.yx,S,P.x,m)-sdShape(fc-e.yx,S,P.x,m))+1e-5);',
      '   vec2 cc=S.xy;float al=P.w;float bev=P.z;float rf=Q.x;float mg=Q.y;',
      '   if(m>.5){float dl=sdLens(fc);float dr=sdRR(q,S.zw,P.x);float wl=smoothstep(8.*uDpr,-8.*uDpr,dl-dr);',
      '    cc=mix(S.xy,uLens.xy,wl);al=mix(P.w,uLens.w,wl);bev=mix(P.z,uLens.z*.62,wl);rf=mix(Q.x,uLens.z*.5,wl);mg=mix(Q.y,.24,wl);}',
      '   vec3 g=glass(fc,cc,d,nr,bev,P.y,rf,mg,Q.z,Q.w,uC[i],.12);',
      '   c=mix(c,g,clamp(.5-d,0.,1.)*al);}',
      ' }',
      ' if(uLens.w>0.&&uMerge<0.){',
      '  float d=sdLens(fc);',
      '  if(d<1.){',
      '   vec2 nr=normalize(vec2(sdLens(fc+e.xy)-sdLens(fc-e.xy),sdLens(fc+e.yx)-sdLens(fc-e.yx))+1e-5);',
      '   vec3 g=glass(fc,uLens.xy,d,nr,uLens.z*.62,0.,uLens.z*' + CONFIG.lens.refract.toFixed(3) + ',' + CONFIG.lens.mag.toFixed(3) + ',' + CONFIG.lens.tint.toFixed(3) + ',' + CONFIG.lens.dark.toFixed(3) + ',vec3(1.),' + CONFIG.lens.disp.toFixed(3) + ');',
      '   c=mix(c,g,clamp(.5-d,0.,1.)*uLens.w);}',
      ' }',
      ' vec2 uv=fc/uRes;',
      ' c*=1.-.28*pow(length(uv-.5)*1.15,2.2);',
      ' c+=(hash(fc+fract(uT*.37)*91.)-.5)*.016;',
      ' gl_FragColor=vec4(c,1.);}'
    ].join('\n');

    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    function program(fs) {
      var p = gl.createProgram();
      gl.attachShader(p, shader(gl.VERTEX_SHADER, VS));
      gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, 'p');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      var u = {};
      var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) {
        var info = gl.getActiveUniform(p, i);
        var name = info.name.replace(/\[0\]$/, '');
        u[name] = gl.getUniformLocation(p, name);
      }
      return { p: p, u: u };
    }

    var P;
    try {
      P = { scene: program(FS_SCENE), copy: program(FS_COPY), blur: program(FS_BLUR), comp: program(FS_COMP) };
    } catch (err) {
      console.warn('[portfolio] WebGL のシェーダーを作れませんでした。CSS のガラスで表示します。', err);
      return null;
    }

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    function tex() {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    function target() { var t = tex(); var f = gl.createFramebuffer(); return { t: t, f: f, w: 0, h: 0 }; }
    function sizeTarget(o, w, h) {
      o.w = w; o.h = h;
      gl.bindTexture(gl.TEXTURE_2D, o.t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, o.f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, o.t, 0);
    }
    var T = { scene: target(), a: target(), b: target() };
    var txtTex = tex();

    function resize() {
      var w = Math.max(1, Math.floor(innerWidth * D));
      var h = Math.max(1, Math.floor(innerHeight * D));
      if (w === W && h === H) return;
      W = w; H = h;
      canvas.width = W; canvas.height = H;
      BW = Math.max(1, Math.ceil(W / 4)); BH = Math.max(1, Math.ceil(H / 4));
      sizeTarget(T.scene, W, H);
      sizeTarget(T.a, BW, BH);
      sizeTarget(T.b, BW, BH);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /* ---- キャンバスに描く文字（名前と大きな見出し） ---- */
    var textEls = Array.prototype.slice.call(document.querySelectorAll('[data-gl-text]')).slice(0, 8);
    var textItems = [];
    var atlasScale = 1;
    function buildAtlas() {
      var cv = document.createElement('canvas');
      var ctx = cv.getContext('2d');
      var items = textEls.map(function (el) {
        var cs = getComputedStyle(el);
        var size = parseFloat(cs.fontSize);
        var r = el.getBoundingClientRect();
        var pad = Math.ceil(size * 0.32);
        return { el: el, text: el.textContent.trim(), cs: cs, size: size, pad: pad, w: r.width + pad * 2, h: r.height + pad * 2,
                 ls: parseFloat(cs.letterSpacing) || 0, lh: parseFloat(cs.lineHeight) || size * 1.2,
                 kind: el.getAttribute('data-gl-text') === 'giant' ? 1 : 0 };
      });
      var maxW = 1, sumH = 0;
      items.forEach(function (it) { maxW = Math.max(maxW, it.w); sumH += it.h + 4; });
      var A = Math.min(D, (MAXTEX - 8) / maxW, (MAXTEX - 8) / sumH);
      atlasScale = A;
      cv.width = Math.ceil(maxW * A); cv.height = Math.ceil(sumH * A);
      var y = 0;
      items.forEach(function (it) {
        ctx.font = it.cs.fontWeight + ' ' + (it.size * A) + 'px ' + it.cs.fontFamily;
        if ('letterSpacing' in ctx) ctx.letterSpacing = (it.ls * A) + 'px';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#fff';
        var m = ctx.measureText(it.text);
        var asc = m.fontBoundingBoxAscent || it.size * A * 0.93;
        var desc = m.fontBoundingBoxDescent || it.size * A * 0.24;
        var lh = it.lh * A;
        var base = y * A + it.pad * A + (lh - (asc + desc)) / 2 + asc;
        ctx.fillText(it.text, it.pad * A, base);
        it.uv = [0, (y * A) / cv.height, (it.w * A) / cv.width, (it.h * A) / cv.height];
        y += it.h + 4;
      });
      gl.bindTexture(gl.TEXTURE_2D, txtTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      textItems = items;
    }

    /* ---- 光る玉（段の位置に合わせて置き、ゆっくりスクロールする） ---- */
    var ORBS = [
      { sel: '#top', fx: 0.80, fy: 0.42, r: 0.15, c: [0.36, 0.52, 1.0] },
      { sel: '#top', fx: 0.10, fy: 0.86, r: 0.06, c: [0.27, 0.89, 0.83] },
      { sel: '#works', fx: 0.93, fy: 0.22, r: 0.17, c: [0.64, 0.45, 1.0] },
      { sel: '#works', fx: 0.04, fy: 0.68, r: 0.11, c: [1.0, 0.50, 0.38] },
      { sel: '#stack', fx: 0.82, fy: 0.55, r: 0.09, c: [0.27, 0.89, 0.83] },
      { sel: '#contact', fx: 0.22, fy: 0.35, r: 0.16, c: [0.36, 0.52, 1.0] }
    ];
    var orbBase = [];
    function measureOrbs() {
      orbBase = ORBS.map(function (o) {
        var el = document.querySelector(o.sel);
        var top = el.getBoundingClientRect().top + S.cur;
        return { x: o.fx, y: top + el.offsetHeight * o.fy, r: Math.max(60, Math.min(300, innerWidth * o.r)) };
      });
    }

    /* ---- ガラスの面 ---- */
    var glassEls = Array.prototype.slice.call(document.querySelectorAll('[data-glass]'));
    var glassMeta = new Map();
    function measureGlass() {
      glassEls.forEach(function (el) {
        var cs = getComputedStyle(el);
        var lens = el.getAttribute('data-kind') === 'lens';
        var base = lens ? CONFIG.navLens : CONFIG.panel;
        var frost = el.hasAttribute('data-frost') ? parseFloat(el.getAttribute('data-frost')) : base.frost;
        var tint = el.hasAttribute('data-tint') ? parseFloat(el.getAttribute('data-tint')) : base.tint;
        var tc = (el.getAttribute('data-tint-color') || '1,1,1').split(',').map(parseFloat);
        glassMeta.set(el, {
          radius: parseFloat(cs.borderTopLeftRadius) || 0,
          z: parseFloat(el.getAttribute('data-z') || '0'),
          frost: frost, tint: tint, tc: tc, dark: lens ? base.dark : base.dark + (1 - frost) * 0.3,
          refract: base.refract, mag: base.mag, lens: lens, order: glassEls.indexOf(el)
        });
      });
    }

    var aS = new Float32Array(64), aP = new Float32Array(64), aQ = new Float32Array(64), aC = new Float32Array(48);
    var aOrb = new Float32Array(24), aOrbC = new Float32Array(18);
    var aTR = new Float32Array(32), aTU = new Float32Array(32), aTA = new Float32Array(32);
    var born = performance.now();
    var dirty = true;

    function collect() {
      var list = [];
      var vh = innerHeight;
      for (var i = 0; i < glassEls.length; i++) {
        var el = glassEls[i];
        var r = el.getBoundingClientRect();
        if (r.width < 1 || r.bottom < -60 || r.top > vh + 60) continue;
        var m = glassMeta.get(el);
        var op = parseFloat(getComputedStyle(el).opacity);
        if (el === navLens) op = NL.alpha;
        var host = el.parentElement && el.parentElement.closest('[data-reveal]');
        if (host) op *= parseFloat(getComputedStyle(host).opacity);
        if (!(op > 0.003)) continue;
        list.push({ el: el, r: r, m: m, op: op });
      }
      list.sort(function (a, b) { return a.m.z - b.m.z || a.m.order - b.m.order; });
      return list.slice(0, 16);
    }

    function render(now) {
      resize();
      var t = reduced ? 40 : (now - born) / 1000;
      var o = L.out;

      /* 1. 背景 */
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.scene.f);
      gl.viewport(0, 0, W, H);
      var u = P.scene.u;
      gl.useProgram(P.scene.p);
      gl.uniform2f(u.uRes, W, H);
      gl.uniform1f(u.uT, t);
      gl.uniform1f(u.uDpr, D);
      var mx = ptr.has ? (ptr.x / innerWidth - 0.5) : 0, my = ptr.has ? (ptr.y / innerHeight - 0.5) : 0;
      for (var i = 0; i < 6; i++) {
        var b = orbBase[i], oc = ORBS[i].c;
        if (!b) continue;
        var bob = reduced ? 0 : Math.sin(t * 0.5 + i * 1.7) * 14;
        var sy = innerHeight / 2 + (b.y - S.cur - innerHeight / 2) * 0.72 + bob - my * 18 * (i % 2 ? 1 : -1);
        var sx = b.x * innerWidth - mx * 22 * (i % 2 ? 1 : -1);
        aOrb[i * 4] = sx * D; aOrb[i * 4 + 1] = H - sy * D; aOrb[i * 4 + 2] = b.r * D; aOrb[i * 4 + 3] = 0;
        aOrbC[i * 3] = oc[0]; aOrbC[i * 3 + 1] = oc[1]; aOrbC[i * 3 + 2] = oc[2];
      }
      gl.uniform4fv(u.uOrb, aOrb);
      gl.uniform3fv(u.uOrbC, aOrbC);
      var tn = 0;
      for (var j = 0; j < textItems.length; j++) {
        var it = textItems[j];
        var r = it.el.getBoundingClientRect();
        var par = 0;
        if (it.kind === 1) par = ((r.top + r.height / 2) - innerHeight / 2) * -0.22;
        var x0 = (r.left - it.pad) * D, y0 = H - (r.bottom + it.pad + par) * D;
        aTR[tn * 4] = x0; aTR[tn * 4 + 1] = y0; aTR[tn * 4 + 2] = it.w * D; aTR[tn * 4 + 3] = it.h * D;
        aTU[tn * 4] = it.uv[0]; aTU[tn * 4 + 1] = it.uv[1]; aTU[tn * 4 + 2] = it.uv[2]; aTU[tn * 4 + 3] = it.uv[3];
        var rv = reduced ? 1 : Math.min(1, Math.max(0, (now - born - 250 - j * 160) / 1300));
        rv = 1 - Math.pow(1 - rv, 3);
        if (it.kind === 1) rv = 1;
        aTA[tn * 4] = it.kind === 1 ? 0.09 : 1; aTA[tn * 4 + 1] = rv; aTA[tn * 4 + 2] = it.kind; aTA[tn * 4 + 3] = 0;
        tn++;
      }
      gl.uniform4fv(u.uTR, aTR); gl.uniform4fv(u.uTU, aTU); gl.uniform4fv(u.uTA, aTA);
      gl.uniform1f(u.uTn, tn);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, txtTex);
      gl.uniform1i(u.uTxt, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      /* 2. すりガラス用のぼかし（1/4 の大きさで2回） */
      gl.viewport(0, 0, BW, BH);
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.a.f);
      gl.useProgram(P.copy.p);
      gl.bindTexture(gl.TEXTURE_2D, T.scene.t);
      gl.uniform1i(P.copy.u.uTex, 0);
      gl.uniform2f(P.copy.u.uPx, 1.2 / W, 1.2 / H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.useProgram(P.blur.p);
      gl.uniform1i(P.blur.u.uTex, 0);
      for (var pass = 0; pass < 2; pass++) {
        var sp = CONFIG.blurSpread[pass];
        gl.bindFramebuffer(gl.FRAMEBUFFER, T.b.f); gl.bindTexture(gl.TEXTURE_2D, T.a.t);
        gl.uniform2f(P.blur.u.uDir, sp / BW, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, T.a.f); gl.bindTexture(gl.TEXTURE_2D, T.b.t);
        gl.uniform2f(P.blur.u.uDir, 0, sp / BH); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      /* 3. 仕上げ */
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.useProgram(P.comp.p);
      var c = P.comp.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.scene.t); gl.uniform1i(c.uScene, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.a.t); gl.uniform1i(c.uBlur, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(c.uRes, W, H);
      gl.uniform1f(c.uDpr, D);
      gl.uniform1f(c.uT, t);

      var list = collect();
      var merge = -1;
      for (var k = 0; k < list.length; k++) {
        var s = list[k], rr = s.r, m = s.m;
        var sc = s.el.offsetWidth ? rr.width / s.el.offsetWidth : 1;
        var rad = Math.min(m.radius * sc, rr.height / 2, rr.width / 2) * D;
        aS[k * 4] = (rr.left + rr.width / 2) * D; aS[k * 4 + 1] = H - (rr.top + rr.height / 2) * D;
        aS[k * 4 + 2] = rr.width / 2 * D; aS[k * 4 + 3] = rr.height / 2 * D;
        var bevel = m.lens ? rad * 0.9 : Math.min(rad * 0.85, 30 * D);
        aP[k * 4] = rad; aP[k * 4 + 1] = m.frost; aP[k * 4 + 2] = Math.max(bevel, 4 * D); aP[k * 4 + 3] = s.op;
        aQ[k * 4] = m.refract * D * (m.lens ? 1 : Math.min(1, rr.height / 160 + 0.35)); aQ[k * 4 + 1] = m.mag; aQ[k * 4 + 2] = m.tint; aQ[k * 4 + 3] = m.dark;
        aC[k * 3] = m.tc[0]; aC[k * 3 + 1] = m.tc[1]; aC[k * 3 + 2] = m.tc[2];
        if (s.el === navLens && o.merge) merge = k;
      }
      gl.uniform4fv(c.uS, aS); gl.uniform4fv(c.uP, aP); gl.uniform4fv(c.uQ, aQ); gl.uniform3fv(c.uC, aC);
      gl.uniform1f(c.uN, list.length);

      var lensOn = o.alpha > 0 && o.r > 1;
      gl.uniform4f(c.uLens, o.x * D, H - o.y * D, o.r * D, lensOn ? o.alpha : 0);
      gl.uniform4f(c.uDrop, o.dx * D, H - o.dy * D, o.dr * D, 0);
      gl.uniform3f(c.uLv, o.sx, -o.sy, o.s);
      gl.uniform1f(c.uMerge, lensOn ? merge : -1);
      gl.uniform1f(c.uMk, Math.max(o.mk * D, 0.01));
      gl.uniform2f(c.uLight, light.x * D, H - light.y * D);
      var ra = (now - ripple.t0) / 1000;
      var rOn = !reduced && ra >= 0 && ra < 1.4;
      gl.uniform4f(c.uRip, ripple.x * D, H - ripple.y * D, ra * 900 * D, rOn ? (1 - ra / 1.4) * (1 - ra / 1.4) : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function remeasure() { measureGlass(); measureOrbs(); buildAtlas(); }
    var rt = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { mobile = coarse || window.matchMedia('(max-width: 760px)').matches; remeasure(); }, 120);
    });
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      html.classList.remove('gl');
      GL = null;
    });

    resize();
    measureGlass();
    measureOrbs();
    buildAtlas();
    // フォントが届いたら文字を描き直す
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { remeasure(); });
    window.addEventListener('load', remeasure);
    html.classList.add('gl');
    return {
      render: render,
      lower: function () {
        if (D <= 1) return;
        D = Math.max(1, D - 0.25);
        W = H = 0;
        remeasure();
      }
    };
  }
})();

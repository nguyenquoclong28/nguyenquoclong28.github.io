// Compositor + Swimmer: đặt các ảnh cá lên ảnh hồ, cho phép kéo-thả, bơi tự động, cấu hình hiệu ứng và xuất ảnh ghép
const fishImages = ['tholan3.jpg','tholan2.jpg','tholan.jpg','sua.jpg','rua.jpg','camap.jpg','ca.jpg'];

const thumbs = document.getElementById('thumbs');
const overlay = document.getElementById('overlay');
const bgImage = document.getElementById('bgImage');
const shadowSlider = document.getElementById('shadow');
const depthSlider = document.getElementById('depth');
const warmthSlider = document.getElementById('warmth');
const randomizeBtn = document.getElementById('randomize');
const resetBtn = document.getElementById('reset');
const exportBtn = document.getElementById('export');

function rand(min,max){return Math.random()*(max-min)+min}

// Active fish objects
const fishes = [];
const elToFish = new Map();

// global current / environment
let globalCurrent = 0; // px/sec horizontal current
let currentTarget = 0;
function lerp(a,b,t){return a + (b-a)*t}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function dist(a,b){ const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx*dx+dy*dy) }

// separation / avoidance strength
const AVOID_RADIUS = 60;
const AVOID_STRENGTH = 80;

// Tạo thumbnails assets
function createThumbs(){
  thumbs.innerHTML = '';
  fishImages.forEach(src=>{
    const img = document.createElement('img'); img.src = src; img.className = 'thumb'; img.draggable = true;
    img.addEventListener('dragstart',(e)=>{ e.dataTransfer.setData('text/plain', src) });
    thumbs.appendChild(img);
  });
}

// Khi kéo ảnh vào overlay, tạo một fish-item
overlay.addEventListener('dragover', e=> e.preventDefault());
overlay.addEventListener('drop', e=>{
  e.preventDefault();
  const src = e.dataTransfer.getData('text/plain');
  if(!src) return;
  const rect = overlay.getBoundingClientRect();
  const x = e.clientX - rect.left; const y = e.clientY - rect.top;
  addFish(src, x, y);
});

function addFish(src, x=null, y=null){
  const item = document.createElement('div'); item.className = 'fish-item';
  const img = document.createElement('img'); img.src = src; img.alt = ''; img.draggable = false;
  item.appendChild(img); overlay.appendChild(item);

  const p = overlay.getBoundingClientRect();
  if(x===null) x = rand(0.15*p.width,0.85*p.width);
  if(y===null) y = rand(0.12*p.height,0.78*p.height);
  item.style.left = x+'px'; item.style.top = y+'px';

  const baseScale = rand(0.45,1.05); const baseRotation = rand(-12,12);
  img.style.transform = `scale(${baseScale}) rotate(${baseRotation}deg)`;

  // physical parameters for swimming (px/sec)
  const speed = rand(18,80); // base speed
  const angle = rand(-0.6,0.6); // small vertical component
  const vx = speed * Math.cos(angle) * (Math.random()>0.5?1:-1);
  const vy = speed * Math.sin(angle);

  const fish = {
    el: item, img, x, y, vx, vy,
    baseScale, baseRotation,
    phase: rand(0,Math.PI*2),
    wiggleFreq: rand(1.2,2.6),
    wiggleAmp: rand(4,10),
    dragging: false
  };
  fishes.push(fish); elToFish.set(item, fish);

  applyFishEffect(item);
  makeDraggable(item);
}

function applyFishEffect(item){
  const img = item.querySelector('img');
  const p = overlay.getBoundingClientRect();
  const rect = item.getBoundingClientRect();
  const depth = Math.max(0, Math.min(1, (rect.top - p.top) / p.height));
  const blur = Math.abs(depth - 0.5) * depthSlider.value * 2;
  const shadow = parseFloat(shadowSlider.value || 12);
  const warmth = parseFloat(warmthSlider.value || 1);
  img.style.filter = `blur(${blur}px) sepia(${0.08*warmth}) contrast(${1 + 0.06*warmth})`;
  item.style.filter = `drop-shadow(0 ${Math.max(2,shadow/6)}px ${Math.max(4,shadow)}px rgba(0,20,40,0.45))`;
}

function applyAll(){ overlay.querySelectorAll('.fish-item').forEach(applyFishEffect); }

function makeDraggable(el){
  const fish = elToFish.get(el);
  let ox=0, oy=0, mx=0, my=0, dragging=false;
  const img = el.querySelector('img');

  el.addEventListener('pointerdown', e=>{
    el.setPointerCapture(e.pointerId);
    dragging = true; fish.dragging = true;
    ox = el.offsetLeft; oy = el.offsetTop; mx = e.clientX; my = e.clientY;
    el.classList.add('selected');
  });

  el.addEventListener('pointermove', e=>{
    if(!dragging) return;
    const dx = e.clientX - mx, dy = e.clientY - my;
    const nx = ox + dx, ny = oy + dy;
    el.style.left = nx + 'px'; el.style.top = ny + 'px';
    fish.x = nx; fish.y = ny;
    applyFishEffect(el);
  });

  el.addEventListener('pointerup', e=>{ dragging=false; fish.dragging = false; try{ el.releasePointerCapture(e.pointerId) }catch{}; el.classList.remove('selected') });

  el.addEventListener('wheel', e=>{
    e.preventDefault();
    const cur = img.style.transform || 'scale(1) rotate(0deg)';
    const m = cur.match(/scale\(([^)]+)\) rotate\(([^)]+)deg\)/);
    let s = fish ? fish.baseScale : 1, r = fish ? fish.baseRotation : 0;
    if(m){ s = parseFloat(m[1]); r = parseFloat(m[2]); }
    if(e.shiftKey) r += e.deltaY * 0.03; else s *= (e.deltaY > 0 ? 0.96 : 1.04);
    s = Math.max(0.12, Math.min(3, s));
    fish.baseScale = s; fish.baseRotation = r;
    img.style.transform = `scale(${s}) rotate(${r}deg)`;
    applyFishEffect(el);
  }, {passive:false});
}

randomizeBtn.addEventListener('click', ()=>{
  // if none, add some
  if(fishes.length === 0){ for(let i=0;i<6;i++) addFish(fishImages[i%fishImages.length]); }
  else {
    const p = overlay.getBoundingClientRect();
    fishes.forEach(f=>{
      f.x = rand(0.12*p.width,0.82*p.width); f.y = rand(0.12*p.height,0.82*p.height);
      f.el.style.left = f.x + 'px'; f.el.style.top = f.y + 'px';
      f.vx = (Math.random()>0.5?1:-1)*rand(18,80); f.vy = rand(-10,10);
      applyFishEffect(f.el);
    });
  }
});

resetBtn.addEventListener('click', ()=>{ overlay.innerHTML = ''; fishes.length = 0; elToFish.clear(); applyAll(); });

exportBtn.addEventListener('click', async ()=>{
  const rect = overlay.getBoundingClientRect(); const canvas = document.createElement('canvas'); const w = Math.round(rect.width), h = Math.round(rect.height); canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d');
  await drawImageToCtx(ctx, bgImage, 0,0,w,h);
  const items = Array.from(overlay.querySelectorAll('.fish-item'));
  for(const item of items){
    const img = item.querySelector('img'); const ir = img.getBoundingClientRect(); const or = overlay.getBoundingClientRect(); const dx = Math.round(ir.left - or.left), dy = Math.round(ir.top - or.top);
    const tf = img.style.transform || 'scale(1) rotate(0deg)'; const m = tf.match(/scale\(([^)]+)\) rotate\(([^)]+)deg\)/); let s=1,r=0; if(m){ s=parseFloat(m[1]); r=parseFloat(m[2])*Math.PI/180; }
    const off = document.createElement('canvas'); off.width = ir.width; off.height = ir.height; const offCtx = off.getContext('2d'); const depth = (ir.top - or.top) / or.height; const blur = Math.abs(depth-0.5)*depthSlider.value*2; offCtx.filter = `blur(${blur}px) sepia(${0.08*warmthSlider.value}) contrast(${1 + 0.06*warmthSlider.value})`; offCtx.drawImage(img, 0,0, off.width, off.height);
    ctx.save(); ctx.filter = 'none'; ctx.translate(dx + off.width/2, dy + off.height/2); ctx.rotate(r); ctx.scale(s,s); ctx.drawImage(off, -off.width/2, -off.height/2, off.width, off.height); ctx.restore();
  }
  const data = canvas.toDataURL('image/png'); const a = document.createElement('a'); a.href = data; a.download = 'ho-ca-composite.png'; a.click();
});

function drawImageToCtx(ctx, imgEl, x,y,w,h){ return new Promise((res)=>{ if(imgEl.complete) { ctx.drawImage(imgEl, x,y,w,h); res(); } else imgEl.onload = ()=>{ ctx.drawImage(imgEl, x,y,w,h); res(); }; }); }

// Bubbles: create bubbles from a fish position (mouth)
function spawnBubbleAt(x,y){
  const b = document.createElement('div'); b.className = 'bubble';
  const size = Math.max(6, Math.random()*18);
  b.style.width = b.style.height = size + 'px';
  b.style.left = (x - size/2) + 'px'; b.style.top = (y - size/2) + 'px';
  overlay.appendChild(b);
  const rise = rand(2400,5200);
  b.animate([
    {transform:'translateY(0)', opacity:0.95},
    {transform:`translateY(-${rand(40,110)}px)`, opacity:0.02}
  ],{duration:rise, easing:'cubic-bezier(.2,.8,.2,1)'}).onfinish = ()=> b.remove();
}

function mouthPositionFor(f){
  const ir = f.img.getBoundingClientRect(); const or = overlay.getBoundingClientRect();
  // approximate mouth position relative to overlay
  const curTransform = f.img.style.transform || '';
  const flip = curTransform.includes('scale(-') || (f.vx < 0 && !curTransform.includes('scale(-'));
  const mx = flip ? ir.left + ir.width*0.18 : ir.left + ir.width*0.82;
  const my = ir.top + ir.height*0.46;
  return {x: mx - or.left, y: my - or.top};
}

let bubbleTimer = null;

// Animation loop for swimming
let lastTime = performance.now();
function tick(t){
  const dt = Math.min(0.05, (t - lastTime)/1000); lastTime = t;
  const bounds = overlay.getBoundingClientRect();
  // slowly adjust global current to target
  globalCurrent = lerp(globalCurrent, currentTarget, clamp(dt*0.2,0,1));

  // simple flocking/avoidance: compute separation
  fishes.forEach(f=>{
    if(f.dragging) return; // paused while dragging
    // wiggle phase
    f.phase += dt * f.wiggleFreq;

    // avoidance
    let ax = 0, ay = 0; let neighbors = 0;
    for(const other of fishes){ if(other === f) continue; const d = dist(f, other); if(d < AVOID_RADIUS && d > 0){ neighbors++; const repel = (AVOID_RADIUS - d)/AVOID_RADIUS; ax += (f.x - other.x)/d * repel; ay += (f.y - other.y)/d * repel; } }
    if(neighbors){ ax = ax / neighbors; ay = ay / neighbors; }

    // apply forces: base velocity + global current + avoidance
    const currentEffect = globalCurrent * 0.25; // gentle influence
    const targetVx = f.vx + currentEffect + ax * AVOID_STRENGTH;
    const targetVy = f.vy + ay * AVOID_STRENGTH * 0.2;

    // smooth velocity change
    f.vx = lerp(f.vx, targetVx, clamp(dt*1.5,0,1));
    f.vy = lerp(f.vy, targetVy, clamp(dt*0.7,0,1));

    // update position with vertical wiggle
    f.x += f.vx * dt;
    f.y += f.vy * dt + Math.sin(f.phase*1.2) * (1.2 + Math.abs(f.vx)/200);

    // element size
    const r = f.el.getBoundingClientRect(); const w = r.width, h = r.height;

    // boundary handling: bounce horizontally, clamp vertically with eased bounce
    if(f.x < 0) {
      f.x = 0;
      f.vx = Math.abs(f.vx) * 0.75; // lose some speed on bounce
      f.phase += Math.PI * 0.5;
    } else if(f.x > bounds.width - w) {
      f.x = bounds.width - w;
      f.vx = -Math.abs(f.vx) * 0.75;
      f.phase += Math.PI * 0.5;
    }
    if(f.y < 5) { f.y = 5; f.vy = Math.abs(f.vy)*0.6; }
    else if(f.y > bounds.height - h - 5) { f.y = bounds.height - h - 5; f.vy = -Math.abs(f.vy)*0.6; }

    // apply position
    f.el.style.left = Math.round(f.x) + 'px'; f.el.style.top = Math.round(f.y) + 'px';

    // update transform: smooth flip based on vx, combine baseScale and wiggle rotation
    const dir = (f.vx >= 0) ? 1 : -1;
    // smooth scaleX towards direction
    const curScale = Math.sign(f.baseScale) * Math.abs(f.baseScale);
    const targetScale = Math.abs(f.baseScale) * dir;
    const smoothScale = lerp(curScale, targetScale, clamp(dt*4,0,1));
    const rot = f.baseRotation + Math.sin(f.phase*2) * (f.wiggleAmp*0.45) + (f.vy*0.05);
    f.img.style.transform = `scale(${smoothScale}) rotate(${rot}deg)`;

    applyFishEffect(f.el);
  });
  requestAnimationFrame(tick);
}

function init(){
  createThumbs();
  // auto spawn some fishes for a lively pond
  const n = 6;
  for(let i=0;i<n;i++) addFish(fishImages[i % fishImages.length]);

  // gentle current target changes over time
  currentTarget = rand(-30,30);
  setInterval(()=>{ currentTarget = rand(-40,40); }, 3500 + Math.random()*3000);

  // bubbles: spawn from random fishes periodically
  bubbleTimer = setInterval(()=>{
    if(fishes.length === 0) return;
    const f = fishes[Math.floor(Math.random()*fishes.length)];
    if(!f) return;
    const pos = mouthPositionFor(f);
    spawnBubbleAt(pos.x + rand(-6,6), pos.y + rand(-3,6));
  }, 700 + Math.random()*400);

  requestAnimationFrame(tick);
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

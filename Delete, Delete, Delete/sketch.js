let grainTile;
let grainOX = 0;
let grainOY = 0;
const GRAIN_SIZE = 256;  
const GRAIN_ALPHA = 75;  

function createGrainTile() {
  grainTile = createGraphics(GRAIN_SIZE, GRAIN_SIZE);
  grainTile.pixelDensity(1);
  grainTile.loadPixels();
  for (let i = 0; i < grainTile.pixels.length; i += 4) {
    const v = random(255);             
    grainTile.pixels[i] = v;
    grainTile.pixels[i + 1] = v;
    grainTile.pixels[i + 2] = v;
    grainTile.pixels[i + 3] = random(GRAIN_ALPHA);
  }
  grainTile.updatePixels();
}

function drawVignette() {
  const ctx = drawingContext;
  const g = ctx.createRadialGradient(
    width / 2, height / 2, min(width, height) * 0.35,
    width / 2, height / 2, max(width, height) * 0.75
  );
  g.addColorStop(0, "rgba(0, 0, 0, 0)");
  g.addColorStop(1, "rgba(0, 0, 0, 0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

function drawGrain() {
  if (frameCount % 6 === 0) {
    grainOX = floor(random(GRAIN_SIZE));
    grainOY = floor(random(GRAIN_SIZE));
  }

  blendMode(OVERLAY);

  for (let x = -grainOX; x < width; x += GRAIN_SIZE) {
    for (let y = -grainOY; y < height; y += GRAIN_SIZE) {
      image(grainTile, x, y);
    }
  }

  blendMode(BLEND); 
}

const Engine = Matter.Engine;

let engine;
let butterflies = [];
let flowers = [];

const BUTTERFLY_COUNT = 10;
const MAX_BUTTERFLY_COUNT = 20;
const FLOWER_COUNT = 18;

const PETAL_COLORS = [
  ["#ffc6d1"],
  ["#b1e0ff"],
  ["#a0f9d7"],
  ["#fdffcd"],
  ["#ffb0c0"],
  ["#ffffff"],
];

function setup() {
  createCanvas(windowWidth, windowHeight);
  createGrainTile();

  engine = Engine.create();
  engine.gravity.y = 0;
  engine.gravity.x = 0;

  createFlowers();

  for (let i = 0; i < BUTTERFLY_COUNT; i++) {
    butterflies.push(spawnButterfly());
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  createFlowers();
}

function draw() {
  background("#9cdca6");
  Engine.update(engine);

  for (let f of flowers) {
    drawFlower(f);
  }

  checkFlowerOverlaps();

  for (let b of butterflies) {
    b.fly();
    b.checkOffScreen();
    b.display();
  }

  for (let i = butterflies.length - 1; i >= 0; i--) {
    if (butterflies[i].death === true) {
      butterflies.splice(i, 1);
    }
  }

  while (butterflies.length < BUTTERFLY_COUNT) {
    butterflies.push(spawnButterfly());
  }

  drawGrain();
}

function mousePressed() {
  let reacted = false;

  for (let b of butterflies) {
    if (b.interact(mouseX, mouseY)) reacted = true;
  }

  if (!reacted && butterflies.length < MAX_BUTTERFLY_COUNT) {
    butterflies.push(new Butterfly(mouseX, mouseY));
  }
}

function spawnButterfly() {
  let x = random(width);
  let y = random(height);
  for (let i = 0; i < 30; i++) {
    x = random(width);
    y = random(height);
    if (!isOnAnyFlower(x, y)) break;
  }
  return new Butterfly(x, y);
}

function isOnAnyFlower(x, y) {
  return flowers.some((f) => dist(x, y, f.x, f.y) < f.R * 1.3);
}

function createFlowers() {
  flowers = [];
  const fs = constrain(min(width, height) / 800, 0.6, 1.4);
  let spacing = 1;
  let tries = 0;

  while (flowers.length < FLOWER_COUNT) {
    const R = 55 * fs * random(0.85, 1.15);
    const x = random(R + 20, width - R - 20);
    const yMin = R + 20;
    const yMax = max(yMin + 1, height - R * 2.4 - 20);
    const y = random(yMin, yMax);

    let overlap = false;
    for (let g of flowers) {
      const w = (R + g.R) * 1.1 * spacing;
      const h = (R + g.R) * 1.65 * spacing;
      if (abs(x - g.x) < w && abs(y - g.y) < h) {
        overlap = true;
        break;
      }
    }

    if (!overlap) {
      flowers.push({
        x: x,
        y: y,
        R: R,
        rot: random(TWO_PI),
        col: random(PETAL_COLORS),
      });
    }

    tries++;
    if (tries % 200 === 0) spacing *= 0.9;
  }
}

function drawFlower(f) {
  const R = f.R;
  const stemTop = f.y + R * 0.7;
  const stemBottom = stemTop + R * 1.6;

  stroke("#65bc7e");
  strokeWeight(max(4, R * 0.105));
  strokeCap(ROUND);
  line(f.x, stemTop, f.x, stemBottom);

  noStroke();
  fill("#65bc7e");
  const leafLen = R * 0.75;
  const leafW = R * 0.34;
  for (const side of [-1, 1]) {
    push();
    translate(f.x, stemBottom - R * 0.05);
    rotate(-side * 0.45);
    ellipse((side * leafLen) / 2, 0, leafLen, leafW);
    pop();
  }

  fill(f.col[0], f.col[1], f.col[2]);
  for (let i = 0; i < 5; i++) {
    const a = f.rot + (i * TWO_PI) / 5;
    circle(f.x + cos(a) * R * 0.55, f.y + sin(a) * R * 0.55, R * 0.95);
  }

  fill("#fdf08e");
  circle(f.x, f.y, R * 0.6);
}

function checkFlowerOverlaps() {
  for (let f of flowers) {
    let overlappingButterflies = [];

    for (let b of butterflies) {
      if (b.state === 0) {
        let pos = b.body.position;
        let d = dist(pos.x, pos.y, f.x, f.y);
        if (d < f.R * 0.9) {
          overlappingButterflies.push(b);
        }
      }
    }

    if (overlappingButterflies.length >= 2) {
      overlappingButterflies[0].state = 1;
      overlappingButterflies[1].state = 1;
    }
  }
}
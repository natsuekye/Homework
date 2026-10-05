function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    y: u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  };
}

function buildPath(segments, steps = 16) {
  const pts = [];
  for (const [p0, p1, p2, p3] of segments) {
    for (let i = 0; i < steps; i++) {
      pts.push(cubicPoint(p0, p1, p2, p3, i / steps));
    }
  }
  return pts;
}

const UPPER_WING = buildPath([
  [[2, -4], [3, -22], [16, -36], [28, -27]],
  [[28, -27], [38, -18], [32, -8], [22, -3]],
  [[22, -3], [14, 0], [8, 0], [2, -1]],
]);

const LOWER_WING = buildPath([
  [[2, 1], [14, 0], [26, 6], [22, 18]],
  [[22, 18], [19, 28], [8, 26], [3, 12]],
  [[3, 12], [1, 8], [1, 5], [2, 1]],
]);

const BUTTERFLY_COLORS = [
  ["#ff98b7"],
  ["#88eca2"],
  ["#7cd4fd"],
  ["#ffe176"],
  ["#efbbff"],
  ["#ffffff"],
];

function shortestAngle(from, to) {
  let d = (to - from) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

class Butterfly {
  constructor(x, y) {
    this.r = 15;

    this.body = Matter.Bodies.circle(x, y, this.r, {
      frictionAir: 0,
      isSensor: true,
    });
    Matter.Composite.add(engine.world, this.body);

    this.t = random(1000);
    this.heading = random(TWO_PI);
    this.angle = this.heading;
    this.baseSpeed = constrain(min(width, height) * 0.004, 1.8, 4) * random(0.9, 1.2);
    this.phase = random(TWO_PI);

    this.state = 0;
    this.alpha = 0;
    this.death = false;
    this.color = random(BUTTERFLY_COLORS);

    this.fleeVel = { x: 0, y: 0 };
  }

  fly() {
    const pos = this.body.position;
    let targetAngle = this.angle;
    let follow = 0.2;

    if (this.state === 0) {
      this.heading += (noise(this.t) - 0.5) * 0.28;
      this.t += 0.01;

      const margin = 80;
      const edge =
        max(0, margin - pos.x, pos.x - (width - margin), margin - pos.y, pos.y - (height - margin)) /
        margin;
      if (edge > 0) {
        const toCenter = atan2(height / 2 - pos.y, width / 2 - pos.x);
        this.heading += shortestAngle(this.heading, toCenter) * min(edge, 1) * 0.12;
      }

      const burst = 0.65 + 0.7 * (0.5 + 0.5 * sin(this.phase));
      const sway = sin(this.phase * 0.5) * 0.7;
      const speed = this.baseSpeed * burst;

      Matter.Body.setVelocity(this.body, {
        x: cos(this.heading) * speed + cos(this.heading + HALF_PI) * sway,
        y: sin(this.heading) * speed + sin(this.heading + HALF_PI) * sway,
      });

      targetAngle = this.heading;
      this.phase += 0.26;
    } else if (this.state === 1) {
      const v = this.body.velocity;
      Matter.Body.setVelocity(this.body, { x: v.x * 0.9, y: v.y * 0.9 });
      this.phase += 0.12;
    } else if (this.state === 2) {
      Matter.Body.setVelocity(this.body, this.fleeVel);
      targetAngle = atan2(this.fleeVel.y, this.fleeVel.x);
      follow = 0.35;
      this.phase += 0.55;
    }

    this.angle += shortestAngle(this.angle, targetAngle) * follow;
  }

  drawPath(pts) {
    beginShape();
    for (const p of pts) vertex(p.x, p.y);
    endShape(CLOSE);
  }

  display() {
    if (this.state === 1) {
      this.alpha -= 15;
      if (this.alpha <= 0) {
        this.alpha = 0;
        this.death = true;
        Matter.Composite.remove(engine.world, this.body);
        return;
      }
    } else if (this.alpha < 255) {
      this.alpha = min(255, this.alpha + 12);
    }

    const pos = this.body.position;
    const k = this.r / 18;
    const flap = 0.3 + 0.7 * (0.5 + 0.5 * sin(this.phase));
    const [r, g, b] = this.color;

    push();
    translate(pos.x, pos.y);
    rotate(this.angle + HALF_PI);
    scale(k);
    noStroke();

    for (const side of [-1, 1]) {
      push();
      scale(side * flap, 1);

      fill(r, g, b, this.alpha);
      this.drawPath(UPPER_WING);

      fill(r + (255 - r) * 0.25, g + (255 - g) * 0.25, b + (255 - b) * 0.25, this.alpha);
      this.drawPath(LOWER_WING);

      fill(255, 255, 255, this.alpha * 0.55);
      circle(19, -17, 10);
      circle(13, 12, 7);
      pop();
    }

    fill(255, 245, 230, this.alpha);
    ellipse(0, 2, 5, 28);
    circle(0, -14, 7);

    noFill();
    stroke(255, 245, 230, this.alpha);
    strokeWeight(1.2);
    for (const side of [-1, 1]) {
      beginShape();
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        vertex(side * (9 * t * t + 1.5 * t), -16 - 12 * t);
      }
      endShape();
    }
    pop();
  }

  interact(mx, my) {
    if (this.state !== 0) return false;

    const pos = this.body.position;
    const d = dist(mx, my, pos.x, pos.y);

    if (d < this.r * 2) {
      this.state = 1;
      return true;
    } else if (d < this.r * 8) {
      this.state = 2;

      let dx = pos.x - mx;
      let dy = pos.y - my;
      if (dx === 0 && dy === 0) {
        dx = random(-1, 1);
        dy = random(-1, 1);
      }

      const len = sqrt(dx * dx + dy * dy);
      const speed = 9;
      this.fleeVel = {
        x: (dx / len) * speed,
        y: (dy / len) * speed,
      };
      return true;
    }

    return false;
  }

  checkOffScreen() {
    const pos = this.body.position;
    if (
      this.state === 2 &&
      (pos.x < -50 || pos.x > width + 50 || pos.y < -50 || pos.y > height + 50)
    ) {
      this.death = true;
      Matter.Composite.remove(engine.world, this.body);
    }
  }
}
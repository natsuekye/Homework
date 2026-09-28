const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;
const Body = Matter.Body;

let engine;

let star1, star2;       
let tri1, tri2;          
let stick1;    
let ball;                      
let ground, leftWall, rightWall; 

function setup() {
  const canvasWidth = 250;
  const canvasHeight = 510;
  createCanvas(canvasWidth, canvasHeight);
  rectMode(CENTER);
  print(Matter);
  
  engine = Engine.create();
  engine.gravity.y = 1.2;

  let wallThick = 30;
  let groundThick = 15;
  
  ground = Bodies.rectangle(width / 2, height - (groundThick / 2), width, groundThick, { isStatic: true });
  leftWall = Bodies.rectangle(0, height / 2, wallThick, height, { isStatic: true });
  rightWall = Bodies.rectangle(width, height / 2, wallThick, height, { isStatic: true });

  star1 = Bodies.polygon(105, -70, 5, 42, { restitution: 0.85, friction: 0.005, density: 0.0007 });
  star2 = Bodies.polygon(160, -130, 5, 32, { restitution: 0.85, friction: 0.015, density: 0.0005 });

  tri1 = Bodies.polygon(180, -80, 3, 47, { restitution: 0.7, friction: 0.05, density: 0.0015 });
  tri2 = Bodies.polygon(100, -120, 3, 33, { restitution: 0.55, friction: 0.05, density: 0.001 });

  stick1 = Bodies.rectangle(160, -160, 13, 150, { angle: -Math.PI * 0.1,  restitution: 0.4, friction: 0.1, density: 0.002 });

  ball = Bodies.circle(125, -30, 13, { restitution: 0.95, friction: 0.0195, density: 0.0005 });

  Composite.add(engine.world, [
    ground, leftWall, rightWall,
    star1, star2, 
    tri1, tri2, 
    stick1, 
    ball
  ]);

  Body.setVelocity(ball, { x: 2.5, y: 1 });      
  Body.setVelocity(star1, { x: -1.5, y: 0 }); 
  Body.setVelocity(star2, { x: 1.5, y: 0.5 });
  
  Body.setAngularVelocity(star1, -0.2); 
  Body.setAngularVelocity(star2, 0.3);                 
  Body.setAngularVelocity(ball, 0.2);
  Body.setAngularVelocity(tri1, -0.2);
  Body.setAngularVelocity(tri2, 0.25);        
  Body.setAngularVelocity(stick1, -0.1);       
}

function draw() {
  background('#5780f1');
  Engine.update(engine);

  fill('#5780f1'); 
  noStroke();
  drawVertices(ground);
  drawVertices(leftWall);
  drawVertices(rightWall);

  fill('#fa84b1'); drawVertices(stick1);

  fill('#a0ceff'); drawVertices(tri1);
  fill('#ffbbe7'); drawVertices(tri2);

  fill('#ffffff');
  drawCircleBody(ball);

  fill('#7cdca7'); drawStarBody(star1, 44, 20, 5);
  fill('#fff3a2'); drawStarBody(star2, 32, 14, 5);
}

function drawVertices(body) {
  beginShape();
  for (let v of body.vertices) {
    vertex(v.x, v.y);
  }
  endShape(CLOSE);
}

function drawCircleBody(body) {
  push();
  translate(body.position.x, body.position.y);
  rotate(body.angle);
  circle(0, 0, body.circleRadius * 2);
  pop();
}

function drawStarBody(body, radius1, radius2, npoints) {
  push();
  translate(body.position.x, body.position.y);
  rotate(body.angle);

  let angle = TWO_PI / npoints;
  let halfAngle = angle / 2.0;

  beginShape();
  for (let a = 0; a < TWO_PI; a += angle) {
    let sx = cos(a) * radius1;
    let sy = sin(a) * radius1;
    vertex(sx, sy);
    sx = cos(a + halfAngle) * radius2;
    sy = sin(a + halfAngle) * radius2;
    vertex(sx, sy);
  }
  endShape(CLOSE);
  pop();
}

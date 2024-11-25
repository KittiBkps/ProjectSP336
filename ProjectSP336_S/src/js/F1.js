import * as THREE from "three";
import { OrbitControls} from '../../threejs/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '../../threejs/examples/jsm/loaders/GLTFLoader.js';
import GUI from '../../threejs/examples/jsm/libs/lil-gui.module.min.js';

import * as CANNON from "../../cannonjs/cannon-es.js";
import CannonDebugger from "../../cannonjs/cannon-es-debugger.js";

let elThreejs = document.getElementById("threejs");
let camera,scene,renderer;
let axesHelper;
let controls;
let gui;
let cubeThree;
let keyboard = {};
let enableFollow = true;
let world;
let cannonDebugger;
let timeStep = 1 / 60;
let cubeBody, planeBody;
let slipperyMaterial, groundMaterial;
let obstacleBody;
let obstaclesBodies = [];
let obstaclesMeshes = [];
let mouseX = 0;
let mouseY = 0;
let cameraRotationX = 0;
let cameraRotationY = 0;

const MAX_ROTATION_Y = Math.PI / 6; 
init();

async function init() {
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(75,window.innerWidth / window.innerHeight,0.1,1000);
  camera.position.z = 10;
  camera.position.y = 5;
	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.enabled = true;
	renderer.outputEncoding = THREE.sRGBEncoding;
  const ambient = new THREE.HemisphereLight(0xffffbb, 0x080820);
  scene.add(ambient);
  const light = new THREE.DirectionalLight(0xFFFFFF, 1);
  light.position.set( 1, 10, 6);
  scene.add(light);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = false;
  window.addEventListener('mousemove', onMouseMove, false);
	elThreejs.appendChild(renderer.domElement);
  initCannon();
  addBackground();
  addPlaneBody();
  addPlane();
  addCubeBody();
  await addCube();
  addObstacleBody();
  addObstacle();
  addContactMaterials();
  addKeysListener();
	addGUI();
  animate()
}

function animate(){
	renderer.render(scene, camera);
  movePlayer();
  if (enableFollow) followPlayer();
  world.step(timeStep);
	cannonDebugger.update();
  cubeThree.position.copy(cubeBody.position);
  cubeThree.position.y = cubeBody.position.y - 1.3;
  cubeThree.quaternion.copy(cubeBody.quaternion);
  for (let i = 0; i < obstaclesBodies.length; i++) {
    obstaclesMeshes[i].position.copy(obstaclesBodies[i].position);
		obstaclesMeshes[i].quaternion.copy(obstaclesBodies[i].quaternion);
	}
	requestAnimationFrame(animate);
}

function addCubeBody(){
  let cubeShape = new CANNON.Box(new CANNON.Vec3(1,1.3,2));
  slipperyMaterial = new CANNON.Material('slippery');
  cubeBody = new CANNON.Body({ mass: 100,material: slipperyMaterial });
  cubeBody.addShape(cubeShape, new CANNON.Vec3(0,0,-1));
  const polyhedronShape = createCustomShape()
  cubeBody.addShape(polyhedronShape, new CANNON.Vec3(-1, -1.3, 1));
  cubeBody.position.set(0, 2, 0);
  cubeBody.linearDamping = 0.5;
  world.addBody(cubeBody);
}

async function addCube(){
  const gltfLoader = new GLTFLoader().setPath( 'src/assets/' );
	const carLoaddedd = await gltfLoader.loadAsync( 'Car/F1.glb' );
	cubeThree = carLoaddedd.scene.children[0];
  scene.add(cubeThree);
}

function addPlaneBody(){
  groundMaterial = new CANNON.Material('ground')
  const planeShape = new CANNON.Box(new CANNON.Vec3(500, 0.01, 2000));
  planeBody = new CANNON.Body({ mass: 0, material: groundMaterial });
  planeBody.addShape(planeShape);
  planeBody.position.set(0, 0, -190);
  world.addBody(planeBody);
}

async function addPlane(){
  const gltfLoader = new GLTFLoader().setPath( 'src/assets/' );
  
  try {
    const v2Loaded = await gltfLoader.loadAsync('Car/Map.glb');
    let v2Mesh = v2Loaded.scene;
    v2Mesh.position.set(0, -0.1, 0);
    v2Mesh.scale.set(1,1,1);
    v2Mesh.rotation.x = 0;
    v2Mesh.rotation.y = Math.PI / 2;
    v2Mesh.rotation.z = 0;
    v2Mesh.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(v2Mesh);
  } catch (error) {
    console.error('Error loading drift.glb:', error);
  }
}

async function addStaticCar() {
  const gltfLoader = new GLTFLoader().setPath('src/assets/');
  const carLoaded = await gltfLoader.loadAsync('Car/car.glb');
  let staticCar = carLoaded.scene.children[0];
  staticCar.scale.set(0.8, 0.8, 0.8);
  staticCar.position.set(0, 1, -30);
  staticCar.rotation.y = Math.PI;
  scene.add(staticCar);
  const box = new THREE.Box3().setFromObject(staticCar);
  const boxHelper = new THREE.Box3Helper(box, 0xffff00);
  scene.add(boxHelper);
  console.log("Car dimensions:", box.getSize(new THREE.Vector3()));
}

function addObstacleBody() {
  for (let i = 0; i < 20; i++) { 
    let radius = 1;
    let sphereShape = new CANNON.Sphere(radius);
    obstacleBody = new CANNON.Body({ mass: 1 });
    obstacleBody.addShape(sphereShape);
    let randomX = Math.random() * 16 - 8;
    obstacleBody.position.set(
      randomX,
      5,
      -(i + 1) * 8 
    );
    world.addBody(obstacleBody);
    obstaclesBodies.push(obstacleBody);
  }
}

function addObstacle() {
  const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
  const texture = new THREE.TextureLoader().load("src/assets/Object/obstacle.png");
  const material = new THREE.MeshBasicMaterial({ map: texture });
  for (let i = 0; i < 20; i++) { 
    let obstacleMesh = new THREE.Mesh(sphereGeometry, material);
    scene.add(obstacleMesh);
    obstaclesMeshes.push(obstacleMesh);
  }
}

function addContactMaterials(){
  const slippery_ground = new CANNON.ContactMaterial(groundMaterial, slipperyMaterial, {
    friction: 0.00,
    restitution: 0.1,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3,
  });
  world.addContactMaterial(slippery_ground)
}

function addKeysListener(){
  window.addEventListener('keydown', function(event){
    keyboard[event.keyCode] = true;
  } , false);
  window.addEventListener('keyup', function(event){
    keyboard[event.keyCode] = false;
  } , false);
}

function movePlayer(){
  const strengthWS = 1000;
  const forceForward = new CANNON.Vec3(0, 0, strengthWS)
  if(keyboard[87]) cubeBody.applyLocalForce(forceForward);
  const forceBack = new CANNON.Vec3(0, 0, -strengthWS)
  if(keyboard[83]) cubeBody.applyLocalForce(forceBack);

  const strengthAD = 1000;
  const forceLeft= new CANNON.Vec3(0, strengthAD, 0)
  if(keyboard[65]) cubeBody.applyTorque(forceLeft);
  const forceRigth= new CANNON.Vec3(0, -strengthAD, 0)
  if(keyboard[68]) cubeBody.applyTorque(forceRigth);

}


function onMouseMove(event) {
  if (!enableFollow) return;
  const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
  cameraRotationX -= movementX * 0.01;
  cameraRotationX = Math.max(-MAX_ROTATION_X, Math.min(MAX_ROTATION_X, cameraRotationX));
}

function followPlayer(){
  if (!enableFollow) return;
  const offset = new THREE.Vector3(0, 5, 10);
  const rotationQuaternion = new THREE.Quaternion();
  rotationQuaternion.setFromEuler(
    new THREE.Euler(cameraRotationY, cameraRotationX, 0, 'XYZ')
  );
  offset.applyQuaternion(rotationQuaternion);
  camera.position.copy(cubeThree.position).add(offset);
  camera.lookAt(cubeThree.position);
}

function addGUI(){
  gui = new GUI();
  const options = {
    sensitivity: 1,
    resetCamera: () => {
      cameraRotationX = 0;
      cameraRotationY = 0;
    }
  }

  const sensitivityFolder = gui.addFolder('Camera Settings');
  sensitivityFolder.add(options, 'sensitivity', 0.1, 2)
    .onChange(value => {
    });
  
  sensitivityFolder.add(options, 'resetCamera').name('Reset Camera');
  gui.hide();
  window.addEventListener('keydown', function(event){
    if(event.keyCode == 71){
      if(gui._hidden){
        gui.show();
      } else {
        gui.hide();
      }
    }
  })
}

window.addEventListener('mousemove', (event) => {
  if (!enableFollow) {
    event.preventDefault();
    return false;
  }
});

function initCannon() {
	world = new CANNON.World();
	world.gravity.set(0, -9.8, 0);

	initCannonDebugger();
}

function initCannonDebugger(){
  cannonDebugger = new CannonDebugger(scene, world, {
		onInit(body, mesh) {
      mesh.visible = false;
			document.addEventListener("keydown", (event) => {
				if (event.key === "f") {
					mesh.visible = !mesh.visible;
				}
			});
		},
	});
}

function createCustomShape(){
  const vertices = [
		new CANNON.Vec3(2, 0, 0),
		new CANNON.Vec3(2, 0, 2),
		new CANNON.Vec3(2, 2, 0),
		new CANNON.Vec3(0, 0, 0),
		new CANNON.Vec3(0, 0, 2),
		new CANNON.Vec3(0, 2, 0),
	]

	return new CANNON.ConvexPolyhedron({
		vertices,
		faces: [
      [3, 4, 5],
			[2, 1, 0],
			[1,2,5,4],
			[0,3,4,1],
			[0,2,5,3],
		]
	})
}

async function addBackground(){
	const gltfLoader = new GLTFLoader().setPath( 'src/assets/' );


	const domeLoaded = await gltfLoader.loadAsync( 'skybox/skydome.glb' );
	let domeMesh = domeLoaded.scene.children[0];
	domeMesh.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 180 *90);
	domeMesh.position.set(0, -40, 0);
	domeMesh.scale.set(0.1, 0.1, 0.1);
	scene.add(domeMesh);
}


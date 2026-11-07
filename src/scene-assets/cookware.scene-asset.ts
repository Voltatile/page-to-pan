import {
  BoxGeometry,
  CircleGeometry,
  createSceneMaterial,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  Vector2,
} from '@iwsdk/core';
import { COOKWARE } from '../config/cookware.js';

/**
 * Real-size placeholder cookware, to be replaced by CC0 models. Origins sit at
 * the object center so a grabbed tool pivots naturally, except the stove and
 * the plate, which sit on the table. Food meshes start hidden; the cooking
 * systems reveal and recolor them by name.
 */

const steelMaterial = new MeshStandardMaterial({
  color: '#B9BEC4',
  roughness: 0.35,
  metalness: 0.7,
  side: DoubleSide,
});
const panMaterial = new MeshStandardMaterial({
  color: '#34363A',
  roughness: 0.55,
  metalness: 0.4,
  side: DoubleSide,
});
const handleMaterial = createSceneMaterial({
  id: 'cookware-handle',
  model: 'standard',
  baseColor: '#2A2118',
  roughness: 0.7,
});
const stoveMaterial = createSceneMaterial({
  id: 'cookware-stove',
  model: 'standard',
  baseColor: '#3C3F44',
  roughness: 0.6,
});
const burnerMaterial = createSceneMaterial({
  id: 'cookware-burner',
  model: 'standard',
  baseColor: '#1E1F22',
  roughness: 0.8,
});
const flameMaterial = new MeshBasicMaterial({ color: '#FF7A1A' });
const plateMaterial = new MeshStandardMaterial({
  color: '#F4F1EA',
  roughness: 0.4,
  side: DoubleSide,
});
const bowlEggMaterial = new MeshStandardMaterial({
  color: '#F5B335',
  roughness: 0.5,
});
const omeletteMaterial = new MeshStandardMaterial({
  color: '#F6E27A',
  roughness: 0.6,
});
const plateOmeletteMaterial = new MeshStandardMaterial({
  color: '#E0A93B',
  roughness: 0.6,
});

function lathe(points: readonly (readonly [number, number])[], segments = 24) {
  return new LatheGeometry(
    points.map(([radius, y]) => new Vector2(radius, y)),
    segments,
  );
}

/** A flat food disc facing up. */
function foodDisc(name: string, radius: number, material: MeshStandardMaterial) {
  const geometry = new CircleGeometry(radius, 24);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.visible = false;
  return mesh;
}

export function createBowl(): Group {
  const { rimRadius, baseRadius, height } = COOKWARE.bowl;
  const half = height / 2;
  const shell = new Mesh(
    lathe([
      [0, -half],
      [baseRadius, -half],
      [rimRadius * 0.88, half * 0.2],
      [rimRadius, half],
    ]),
    steelMaterial,
  );
  shell.name = 'BowlShell';
  const egg = foodDisc('BowlEgg', rimRadius * 0.72, bowlEggMaterial);
  egg.position.y = -half * 0.35;

  const bowl = new Group();
  bowl.name = 'Bowl';
  bowl.add(shell, egg);
  return bowl;
}

export function createWhisk(): Group {
  const { length } = COOKWARE.whisk;
  const handleLength = length * 0.45;
  const handleGeometry = new CylinderGeometry(0.009, 0.011, handleLength, 8);
  handleGeometry.rotateZ(Math.PI / 2);
  const handle = new Mesh(handleGeometry, handleMaterial);
  handle.name = 'WhiskHandle';
  handle.position.x = length / 2 - handleLength / 2;

  const balloonLength = length - handleLength;
  const balloonGeometry = lathe(
    [
      [0.004, 0],
      [0.022, balloonLength * 0.45],
      [0.024, balloonLength * 0.75],
      [0.012, balloonLength * 0.96],
      [0, balloonLength],
    ],
    6,
  );
  balloonGeometry.rotateZ(Math.PI / 2);
  const balloon = new Mesh(balloonGeometry, steelMaterial);
  balloon.name = 'WhiskBalloon';
  balloon.position.x = length / 2 - handleLength;

  const whisk = new Group();
  whisk.name = 'Whisk';
  whisk.add(handle, balloon);
  return whisk;
}

/** Handle points +Z, toward the seated player. */
export function createPan(): Group {
  const { rimRadius, baseRadius, height, handleLength } = COOKWARE.pan;
  const half = height / 2;
  const body = new Mesh(
    lathe([
      [0, -half],
      [baseRadius, -half],
      [rimRadius, half],
    ]),
    panMaterial,
  );
  body.name = 'PanBody';
  const handle = new Mesh(
    new BoxGeometry(0.022, 0.012, handleLength),
    handleMaterial,
  );
  handle.name = 'PanHandle';
  handle.position.set(0, half * 0.6, rimRadius + handleLength / 2 - 0.004);
  const egg = foodDisc('PanEgg', baseRadius * 0.95, omeletteMaterial);
  egg.position.y = -half + 0.003;

  const pan = new Group();
  pan.name = 'Pan';
  pan.add(body, handle, egg);
  return pan;
}

/** Origin at table contact. The flame ring stays hidden until the pan heats. */
export function createStove(): Group {
  const { width, height } = COOKWARE.stove;
  const base = new Mesh(new BoxGeometry(width, height, width), stoveMaterial);
  base.name = 'StoveBase';
  base.position.y = height / 2;

  const burnerGeometry = new CircleGeometry(width * 0.4, 24);
  burnerGeometry.rotateX(-Math.PI / 2);
  const burner = new Mesh(burnerGeometry, burnerMaterial);
  burner.name = 'StoveBurner';
  burner.position.y = height + 0.001;

  const flameGeometry = new RingGeometry(width * 0.3, width * 0.38, 24);
  flameGeometry.rotateX(-Math.PI / 2);
  const flame = new Mesh(flameGeometry, flameMaterial);
  flame.name = 'StoveFlame';
  flame.position.y = height + 0.002;
  flame.visible = false;

  const stove = new Group();
  stove.name = 'Stove';
  stove.add(base, burner, flame);
  return stove;
}

/** Origin at table contact. */
export function createPlate(): Group {
  const { radius, height } = COOKWARE.plate;
  const dish = new Mesh(
    lathe([
      [0, 0],
      [radius * 0.65, 0],
      [radius, height],
    ]),
    plateMaterial,
  );
  dish.name = 'PlateDish';
  const omelette = foodDisc('PlateOmelette', radius * 0.6, plateOmeletteMaterial);
  omelette.position.y = 0.004;
  omelette.scale.z = 0.55;

  const plate = new Group();
  plate.name = 'Plate';
  plate.add(dish, omelette);
  return plate;
}

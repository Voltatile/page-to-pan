import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  createSceneMaterial,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
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
const flameMaterial = new MeshBasicMaterial({
  color: '#FF7A1A',
  side: DoubleSide,
});
const plateMaterial = new MeshStandardMaterial({
  color: '#FFFFFF',
  roughness: 0.35,
  side: DoubleSide,
});
const bowlEggMaterial = new MeshStandardMaterial({
  color: '#F5B335',
  roughness: 0.5,
});
const panButterMaterial = new MeshStandardMaterial({
  color: '#F5D76E',
  roughness: 0.4,
});
/** Double-sided: the omelette shows its underside as it turns in the air. */
const onionSpeckMaterial = new MeshStandardMaterial({
  color: '#5FA845',
  roughness: 0.7,
  side: DoubleSide,
});
const omeletteMaterial = new MeshStandardMaterial({
  color: '#F6E27A',
  roughness: 0.6,
  side: DoubleSide,
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

/** A soft, thick omelette, with its origin at the middle of its thickness. */
function omeletteMesh(
  name: string,
  radius: number,
  material: MeshStandardMaterial,
) {
  const half = COOKWARE.omelette.thickness / 2;
  const mesh = new Mesh(
    lathe([
      [0, -half],
      [radius * 0.9, -half],
      [radius, 0],
      [radius * 0.92, half * 0.8],
      [radius * 0.5, half],
      [0, half],
    ]),
    material,
  );
  mesh.name = name;
  mesh.visible = false;
  return mesh;
}

/**
 * Chopped green onion: small flat slivers in one mesh, one draw call. A spiral
 * spreads them evenly and keeps the asset deterministic.
 */
function onionSpecks(name: string, radius: number): Mesh {
  const count = 16;
  const halfLength = 0.004;
  const halfWidth = 0.0013;
  const positions: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const spread = radius * Math.sqrt((index + 0.5) / count);
    const angle = index * 2.4;
    const x = Math.cos(angle) * spread;
    const z = Math.sin(angle) * spread;
    const lengthX = Math.cos(angle * 3) * halfLength;
    const lengthZ = Math.sin(angle * 3) * halfLength;
    const widthX = -lengthZ * (halfWidth / halfLength);
    const widthZ = lengthX * (halfWidth / halfLength);
    const corners = [
      [x - lengthX - widthX, z - lengthZ - widthZ],
      [x + lengthX - widthX, z + lengthZ - widthZ],
      [x + lengthX + widthX, z + lengthZ + widthZ],
      [x - lengthX + widthX, z - lengthZ + widthZ],
    ];
    for (const corner of [0, 1, 2, 0, 2, 3]) {
      const [cornerX = 0, cornerZ = 0] = corners[corner] ?? [];
      positions.push(cornerX, 0, cornerZ);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, onionSpeckMaterial);
  mesh.name = name;
  mesh.visible = false;
  return mesh;
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
  const WALL = 0.004;
  const { rimRadius, baseRadius, height } = COOKWARE.bowl;
  const half = height / 2;
  const shell = new Mesh(
    lathe([
      [0, -half],
      [baseRadius, -half],
      [rimRadius * 0.88, half * 0.2],
      [rimRadius, half],
      [rimRadius - WALL, half],
      [rimRadius * 0.88 - WALL, half * 0.2],
      [baseRadius - WALL, -half + WALL],
      [0, -half + WALL],
    ]),
    steelMaterial,
  );
  shell.name = 'BowlShell';
  const egg = foodDisc('BowlEgg', rimRadius * 0.72, bowlEggMaterial);
  egg.position.y = -half * 0.35;
  const onion = onionSpecks('BowlOnion', rimRadius * 0.6);
  onion.position.y = 0.001;
  egg.add(onion);

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

/**
 * A flat turner for stirring rice in the pan. Like the whisk it lies along X,
 * handle at +X and blade at -X, so both tools pose the same way in the hand.
 */
export function createSpatula(): Group {
  const { length, bladeWidth, bladeLength } = COOKWARE.spatula;
  const handleLength = length * 0.5;
  const handleGeometry = new CylinderGeometry(0.009, 0.011, handleLength, 8);
  handleGeometry.rotateZ(Math.PI / 2);
  const handle = new Mesh(handleGeometry, handleMaterial);
  handle.name = 'SpatulaHandle';
  handle.position.x = length / 2 - handleLength / 2;

  const neckLength = length - handleLength - bladeLength;
  const neckGeometry = new CylinderGeometry(0.004, 0.004, neckLength, 6);
  neckGeometry.rotateZ(Math.PI / 2);
  const neck = new Mesh(neckGeometry, steelMaterial);
  neck.name = 'SpatulaNeck';
  neck.position.x = length / 2 - handleLength - neckLength / 2;

  const blade = new Mesh(
    new BoxGeometry(bladeLength, 0.003, bladeWidth),
    steelMaterial,
  );
  blade.name = 'SpatulaBlade';
  blade.position.x = -length / 2 + bladeLength / 2;

  const spatula = new Group();
  spatula.name = 'Spatula';
  spatula.add(handle, neck, blade);
  return spatula;
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
  const egg = omeletteMesh('PanEgg', baseRadius * 0.95, omeletteMaterial);
  egg.position.y = -half + 0.003 + COOKWARE.omelette.thickness / 2;
  const onion = onionSpecks('PanOnion', baseRadius * 0.65);
  onion.position.y = COOKWARE.omelette.thickness / 2 + 0.0006;
  egg.add(onion);
  const butter = foodDisc('PanButter', 0.04, panButterMaterial);
  butter.position.y = -half + 0.002;

  const pan = new Group();
  pan.name = 'Pan';
  pan.add(body, handle, egg, butter);
  return pan;
}

/** Origin at table contact. The flame ring stays hidden until the pan heats. */
export function createStove(): Group {
  const { width, height, grateHeight } = COOKWARE.stove;
  const base = new Mesh(new BoxGeometry(width, height, width), stoveMaterial);
  base.name = 'StoveBase';
  base.position.y = height / 2;

  const burnerGeometry = new CircleGeometry(width * 0.4, 24);
  burnerGeometry.rotateX(-Math.PI / 2);
  const burner = new Mesh(burnerGeometry, burnerMaterial);
  burner.name = 'StoveBurner';
  burner.position.y = height + 0.001;

  // Two crossed bars hold the pan above the burner.
  const grate = new Group();
  grate.name = 'StoveGrate';
  for (const [index, turn] of [0, Math.PI / 2].entries()) {
    const bar = new Mesh(
      new BoxGeometry(width * 0.74, grateHeight, 0.012),
      burnerMaterial,
    );
    bar.name = `GrateBar${index}`;
    bar.rotation.y = turn;
    bar.position.y = height + grateHeight / 2;
    grate.add(bar);
  }

  // Flames flare out from under the pan, so they show around its rim.
  const flame = new Mesh(
    lathe([
      [COOKWARE.pan.baseRadius, 0],
      [COOKWARE.pan.rimRadius + 0.012, 0.012],
    ]),
    flameMaterial,
  );
  flame.name = 'StoveFlame';
  flame.position.y = height + 0.002;
  flame.visible = false;

  const stove = new Group();
  stove.name = 'Stove';
  stove.add(base, burner, grate, flame);
  return stove;
}

/** Origin at table contact. */
export function createPlate(): Group {
  const { radius, height, wellRadius, wellDepth } = COOKWARE.plate;
  // One closed profile: foot ring, underside, rolled rim, sloped shoulder,
  // and a sunken well in the middle where the food sits.
  const dish = new Mesh(
    lathe(
      [
        [0, 0.002],
        [wellRadius * 0.9, 0.002],
        [wellRadius * 0.95, 0],
        [wellRadius * 1.15, 0],
        [radius * 0.96, height * 0.75],
        [radius, height * 0.88],
        [radius * 0.99, height],
        [radius * 0.92, height * 0.98],
        [wellRadius * 1.25, wellDepth + 0.004],
        [wellRadius, wellDepth],
        [0, wellDepth],
      ],
      32,
    ),
    plateMaterial,
  );
  dish.name = 'PlateDish';
  const omelette = omeletteMesh(
    'PlateOmelette',
    radius * 0.6,
    plateOmeletteMaterial,
  );
  omelette.position.y = wellDepth + COOKWARE.omelette.thickness * 0.8;
  omelette.scale.set(1, 1.6, 0.55);
  const onion = onionSpecks('PlateOnion', radius * 0.45);
  onion.position.y = COOKWARE.omelette.thickness / 2 + 0.0006;
  omelette.add(onion);

  const plate = new Group();
  plate.name = 'Plate';
  plate.add(dish, omelette);
  return plate;
}

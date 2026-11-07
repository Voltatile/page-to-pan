import {
  BackSide,
  BoxGeometry,
  createSceneMaterial,
  createScenePrimitiveObject,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from '@iwsdk/core';

/**
 * Table surface height above the floor, in meters.
 * QUEST-CHECK: matches the emulator's standing head, not a seated one. See
 * docs/quest-checklist.md.
 */
export const TABLE_TOP_HEIGHT_M = 0.88;

const woodMaterial = createSceneMaterial({
  id: 'kitchen-wood',
  model: 'standard',
  baseColor: '#B98A5E',
  roughness: 0.7,
});
const darkWoodMaterial = createSceneMaterial({
  id: 'kitchen-dark-wood',
  model: 'standard',
  baseColor: '#7C5A3C',
  roughness: 0.75,
});
const wallMaterial = new MeshStandardMaterial({
  color: '#EADFCB',
  roughness: 0.95,
  side: BackSide,
});
const floorMaterial = createSceneMaterial({
  id: 'kitchen-floor',
  model: 'standard',
  baseColor: '#8C6B4F',
  roughness: 0.85,
});
const cabinetMaterial = createSceneMaterial({
  id: 'kitchen-cabinet',
  model: 'standard',
  baseColor: '#7E9C8E',
  roughness: 0.6,
});
const counterMaterial = createSceneMaterial({
  id: 'kitchen-counter',
  model: 'standard',
  baseColor: '#D9D4C9',
  roughness: 0.45,
});
const tileMaterial = createSceneMaterial({
  id: 'kitchen-tile',
  model: 'standard',
  baseColor: '#F4EFE6',
  roughness: 0.35,
});

function boxMesh(
  name: string,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  material: Material,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  return mesh;
}

/**
 * Seated work table. Origin is at floor contact under the table center, with
 * the seated player on the +Z side. Top surface: 1.2 x 0.7 m.
 */
export function createKitchenTable(): Group {
  const thickness = 0.04;
  const top = createScenePrimitiveObject(
    {
      geometry: {
        type: 'roundedBox',
        size: [1.2, thickness, 0.7],
        radius: 0.012,
        segments: 2,
      },
    },
    woodMaterial,
  );
  top.name = 'TableTop';
  top.position.y = TABLE_TOP_HEIGHT_M - thickness / 2;

  const legHeight = TABLE_TOP_HEIGHT_M - thickness;
  const apronHeight = 0.07;
  const table = new Group();
  table.name = 'KitchenTable';
  table.add(
    top,
    boxMesh(
      'Apron',
      [1.06, apronHeight, 0.56],
      [0, legHeight - apronHeight / 2, 0],
      darkWoodMaterial,
    ),
  );
  for (const [index, [x, z]] of [
    [-0.54, -0.29],
    [0.54, -0.29],
    [-0.54, 0.29],
    [0.54, 0.29],
  ].entries()) {
    table.add(
      boxMesh(
        `Leg${index}`,
        [0.06, legHeight, 0.06],
        [x, legHeight / 2, z],
        darkWoodMaterial,
      ),
    );
  }
  return table;
}

/**
 * Simple kitchen shell around the player: floor, walls, and a counter run
 * along the -Z wall. Origin is at floor level under the seated player.
 */
export function createKitchenRoom(): Group {
  const room = new Group();
  room.name = 'KitchenRoom';

  const shell = new Mesh(new BoxGeometry(4.6, 2.7, 4.4), wallMaterial);
  shell.name = 'Walls';
  shell.position.set(0, 1.35, -0.4);

  const floorGeometry = new PlaneGeometry(4.6, 4.4);
  floorGeometry.rotateX(-Math.PI / 2);
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.name = 'Floor';
  floor.position.set(0, 0.001, -0.4);

  room.add(
    shell,
    floor,
    boxMesh('BaseCabinets', [3.4, 0.86, 0.6], [0, 0.43, -2.28], cabinetMaterial),
    boxMesh('Countertop', [3.5, 0.04, 0.66], [0, 0.88, -2.26], counterMaterial),
    boxMesh('Backsplash', [3.4, 0.56, 0.02], [0, 1.18, -2.59], tileMaterial),
    boxMesh(
      'WallCabinets',
      [3.4, 0.72, 0.34],
      [0, 1.82, -2.42],
      cabinetMaterial,
    ),
  );
  return room;
}

/**
 * Wooden stand that props the recipe card at 45 degrees toward the seated
 * player. Origin is at table contact under the front lip.
 */
export function createRecipeStand(): Group {
  const stand = new Group();
  stand.name = 'RecipeStand';

  const board = boxMesh(
    'Board',
    [0.46, 0.21, 0.012],
    [0, 0.0743, -0.0743],
    woodMaterial,
  );
  board.rotation.x = -Math.PI / 4;

  stand.add(
    board,
    boxMesh('FrontLip', [0.46, 0.014, 0.03], [0, 0.007, 0.01], woodMaterial),
    boxMesh(
      'RearStrut',
      [0.4, 0.11, 0.012],
      [0, 0.055, -0.125],
      darkWoodMaterial,
    ),
  );
  return stand;
}

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  type Material,
  Mesh,
} from '@iwsdk/core';

/**
 * A positioned mesh and the color its vertices take in the merged mesh, or
 * null to keep the part's own vertex colors (white where it has none).
 */
export type ColoredPart = readonly [mesh: Mesh, color: string | null];

/**
 * Bakes several static meshes into one, keeping each part's color as a
 * vertex color. One mesh is one draw call per eye instead of one per part.
 * Each part's own transform, relative to its parent, is baked in.
 */
export function mergeColored(
  name: string,
  parts: readonly ColoredPart[],
  material: Material,
): Mesh {
  const baked = parts.map(([mesh, color]) => {
    mesh.updateMatrix();
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);
    return { geometry, color: color == null ? null : new Color(color) };
  });
  let vertexCount = 0;
  let indexCount = 0;
  for (const { geometry } of baked) {
    const vertices = geometry.getAttribute('position').count;
    vertexCount += vertices;
    indexCount += geometry.index?.count ?? vertices;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices =
    vertexCount > 65535
      ? new Uint32Array(indexCount)
      : new Uint16Array(indexCount);
  let vertexOffset = 0;
  let indexOffset = 0;
  for (const { geometry, color } of baked) {
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const ownColor = geometry.getAttribute('color') as
      | ReturnType<typeof geometry.getAttribute>
      | undefined;
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const at = (vertexOffset + vertex) * 3;
      positions[at] = position.getX(vertex);
      positions[at + 1] = position.getY(vertex);
      positions[at + 2] = position.getZ(vertex);
      normals[at] = normal.getX(vertex);
      normals[at + 1] = normal.getY(vertex);
      normals[at + 2] = normal.getZ(vertex);
      colors[at] = color?.r ?? ownColor?.getX(vertex) ?? 1;
      colors[at + 1] = color?.g ?? ownColor?.getY(vertex) ?? 1;
      colors[at + 2] = color?.b ?? ownColor?.getZ(vertex) ?? 1;
    }
    const index = geometry.index;
    const count = index?.count ?? position.count;
    for (let item = 0; item < count; item += 1) {
      indices[indexOffset + item] =
        vertexOffset + (index == null ? item : index.getX(item));
    }
    vertexOffset += position.count;
    indexOffset += count;
    geometry.dispose();
  }
  const merged = new BufferGeometry();
  merged.setAttribute('position', new BufferAttribute(positions, 3));
  merged.setAttribute('normal', new BufferAttribute(normals, 3));
  merged.setAttribute('color', new BufferAttribute(colors, 3));
  merged.setIndex(new BufferAttribute(indices, 1));
  merged.computeBoundingSphere();
  const mesh = new Mesh(merged, material);
  mesh.name = name;
  return mesh;
}

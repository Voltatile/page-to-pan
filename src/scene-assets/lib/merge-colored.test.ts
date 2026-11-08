import {
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import { mergeColored } from './merge-colored.js';

describe('mergeColored', () => {
  const material = new MeshStandardMaterial({ vertexColors: true });

  it('keeps every vertex and triangle of every part', () => {
    const box = new Mesh(new BoxGeometry(1, 1, 1));
    const plane = new Mesh(new PlaneGeometry(1, 1).toNonIndexed());
    const merged = mergeColored(
      'Merged',
      [
        [box, '#FF0000'],
        [plane, '#0000FF'],
      ],
      material,
    );
    const boxVertices = box.geometry.getAttribute('position').count;
    const planeVertices = plane.geometry.getAttribute('position').count;
    expect(merged.geometry.getAttribute('position').count).toBe(
      boxVertices + planeVertices,
    );
    expect(merged.geometry.index?.count).toBe(
      (box.geometry.index?.count ?? 0) + planeVertices,
    );
    expect(merged.name).toBe('Merged');
  });

  it('bakes each part position and color', () => {
    const box = new Mesh(new BoxGeometry(0.2, 0.2, 0.2));
    box.position.set(1, 2, 3);
    const merged = mergeColored('Merged', [[box, '#00FF00']], material);
    merged.geometry.computeBoundingBox();
    const center = merged.geometry.boundingBox?.getCenter(box.position.clone());
    expect(center?.x).toBeCloseTo(1);
    expect(center?.y).toBeCloseTo(2);
    expect(center?.z).toBeCloseTo(3);
    const color = merged.geometry.getAttribute('color');
    const green = new Color('#00FF00');
    expect(color.getY(0)).toBeCloseTo(green.g);
    expect(color.getX(0)).toBeCloseTo(green.r);
  });

  it('keeps the own vertex colors of a part given no color', () => {
    const geometry = new BoxGeometry();
    const count = geometry.getAttribute('position').count;
    geometry.setAttribute(
      'color',
      new Float32BufferAttribute(new Array(count * 3).fill(0.25), 3),
    );
    const merged = mergeColored(
      'Merged',
      [[new Mesh(geometry), null]],
      material,
    );
    expect(merged.geometry.getAttribute('color').getX(0)).toBeCloseTo(0.25);
  });

  it('points each part index at its own vertices', () => {
    const first = new Mesh(new BoxGeometry());
    const second = new Mesh(new BoxGeometry());
    const merged = mergeColored(
      'Merged',
      [
        [first, '#FFFFFF'],
        [second, '#FFFFFF'],
      ],
      material,
    );
    const index = merged.geometry.index;
    const half = (index?.count ?? 0) / 2;
    expect(index?.getX(half)).toBe(
      (first.geometry.index?.getX(0) ?? 0) +
        first.geometry.getAttribute('position').count,
    );
  });
});

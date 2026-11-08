import {
  CanvasTexture,
  createSystem,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  PlaneGeometry,
} from '@iwsdk/core';

/** The overlay only exists when the page is opened with `?debug=1`. */
export function isDebugEnabled(search: string = window.location.search) {
  return new URLSearchParams(search).get('debug') === '1';
}

/** Budget from the brief, for a Quest 2 at 72 Hz. */
const BUDGET = { minFps: 60, maxDrawCalls: 100, maxSceneTriangles: 100_000 };

const REFRESH_S = 0.5;
const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 256;
const PANEL_WIDTH_M = 0.3;
/** Left of the table, standing up and turned toward the seat. */
const PANEL_POSITION = [-0.42, 1.04, -0.5] as const;
const PANEL_YAW_RAD = 0.7;
/** The same numbers go to the console this often, for remote checks. */
const LOG_EVERY_S = 5;

const GOOD = '#7CE38B';
const BAD = '#FF6B6B';

/**
 * Frame rate, draw calls and triangle counts on a small board beside the
 * table, so the budget can be read inside a real headset.
 * QUEST-CHECK: renderer.info counts both eyes of one XR frame together.
 */
export class DebugOverlaySystem extends createSystem({}) {
  private readonly canvas = document.createElement('canvas');
  private context!: CanvasRenderingContext2D;
  private texture!: CanvasTexture;
  private panel!: Mesh;
  private elapsedS = 0;
  private frames = 0;
  private worstFrameS = 0;
  private sceneTriangles = 0;
  private sinceLogS = 0;
  private readonly meshesByRoot = new Map<string, number>();
  private readonly countByRoot = (object: Object3D) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    // Name the node one level under the scene's top group, such as a level
    // node, so the counts point at real scene items.
    let root: Object3D = object;
    let child: Object3D = object;
    while (root.parent != null && root.parent !== this.world.scene) {
      child = root;
      root = root.parent;
    }
    const name = `${root.name || root.type}/${child.name || child.type}`;
    this.meshesByRoot.set(name, (this.meshesByRoot.get(name) ?? 0) + 1);
  };
  private readonly countTriangles = (object: Object3D) => {
    if (!(object instanceof Mesh) || object === this.panel) {
      return;
    }
    const geometry = object.geometry;
    const vertices = geometry.index?.count ?? geometry.attributes.position?.count;
    if (vertices == null) {
      return;
    }
    const drawn = Math.min(vertices, geometry.drawRange.count);
    const copies = object instanceof InstancedMesh ? object.count : 1;
    this.sceneTriangles += Math.floor(drawn / 3) * copies;
  };

  init(): void {
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    const context = this.canvas.getContext('2d');
    if (context == null) {
      return;
    }
    this.context = context;
    this.texture = new CanvasTexture(this.canvas);
    this.panel = new Mesh(
      new PlaneGeometry(
        PANEL_WIDTH_M,
        (PANEL_WIDTH_M * CANVAS_HEIGHT) / CANVAS_WIDTH,
      ),
      new MeshBasicMaterial({ map: this.texture, toneMapped: false }),
    );
    this.panel.name = 'DebugOverlay';
    this.panel.position.set(...PANEL_POSITION);
    this.panel.rotation.y = PANEL_YAW_RAD;
    this.world.scene.add(this.panel);
    this.cleanupFuncs.push(() => {
      this.panel.removeFromParent();
      this.texture.dispose();
    });
  }

  update(delta: number): void {
    if (this.panel == null) {
      return;
    }
    this.elapsedS += delta;
    this.frames += 1;
    this.worstFrameS = Math.max(this.worstFrameS, delta);
    if (this.elapsedS < REFRESH_S) {
      return;
    }
    this.sceneTriangles = 0;
    this.world.scene.traverseVisible(this.countTriangles);
    const fps = this.frames / this.elapsedS;
    this.draw(fps);
    this.sinceLogS += this.elapsedS;
    if (this.sinceLogS >= LOG_EVERY_S) {
      this.sinceLogS = 0;
      const { render } = this.renderer.info;
      console.info(
        `[debug] fps=${fps.toFixed(0)} worstMs=${(this.worstFrameS * 1000).toFixed(0)} ` +
          `calls=${render.calls} sceneTris=${this.sceneTriangles} drawnTris=${render.triangles}`,
      );
      this.logMeshes();
    }
    this.elapsedS = 0;
    this.frames = 0;
    this.worstFrameS = 0;
  }

  /** Which top-level objects hold the visible meshes, most first. */
  private logMeshes(): void {
    this.meshesByRoot.clear();
    this.world.scene.traverseVisible(this.countByRoot);
    const parts = [...this.meshesByRoot]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name}=${count}`);
    console.info(`[debug-meshes] ${parts.join(' ')}`);
  }

  private draw(fps: number): void {
    const { context: ctx } = this;
    const { render, memory } = this.renderer.info;
    ctx.fillStyle = '#101418';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.font = 'bold 34px sans-serif';
    ctx.textBaseline = 'top';
    const rows: [string, string, boolean][] = [
      [
        'FPS',
        `${fps.toFixed(0)}  (worst ${(this.worstFrameS * 1000).toFixed(0)} ms)`,
        fps >= BUDGET.minFps,
      ],
      ['Draw calls', String(render.calls), render.calls < BUDGET.maxDrawCalls],
      [
        'Scene tris',
        this.sceneTriangles.toLocaleString('en-US'),
        this.sceneTriangles < BUDGET.maxSceneTriangles,
      ],
      ['Drawn tris', render.triangles.toLocaleString('en-US'), true],
      [
        'Memory',
        `${memory.geometries} geo, ${memory.textures} tex`,
        true,
      ],
    ];
    rows.forEach(([label, value, isGood], index) => {
      const y = 18 + index * 46;
      ctx.fillStyle = '#C9D1D9';
      ctx.fillText(label, 20, y);
      ctx.fillStyle = isGood ? GOOD : BAD;
      ctx.fillText(value, 210, y);
    });
    this.texture.needsUpdate = true;
  }
}

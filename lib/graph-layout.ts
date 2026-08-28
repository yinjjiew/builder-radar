/**
 * A small deterministic force-directed layout.
 *
 * The graph is drawn as plain SVG on the server rather than simulated in the
 * browser. That keeps the page free of client JavaScript, makes anchor tags work
 * natively for every node, and means the picture is identical on every render —
 * a layout seeded from Math.random would rearrange itself on each page load and
 * destroy any sense that a node's position means something.
 *
 * At well under a hundred nodes the naive all-pairs repulsion is a few million
 * operations, which is far cheaper than shipping a physics library.
 */

export type LayoutInput = {
  id: string;
  weight: number;
  radius: number;
  pinned: boolean;
};

export type LayoutEdge = { source: string; target: string };

export type Positioned = { id: string; x: number; y: number };

const ITERATIONS = 500;
// Separate collision passes at the end. The force phase gets the shape right but
// leaves circles touching; these passes guarantee every node is clickable.
const COLLISION_PASSES = 90;
const NODE_GAP = 7;

const WIDTH = 1240;
const HEIGHT = 900;
// Wide enough that a label sitting above a node near the edge is still inside
// the viewBox.
const MARGIN = 62;

/** Seeded generator so node placement is stable between renders. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function layoutGraph(nodes: LayoutInput[], edges: LayoutEdge[]) {
  const count = nodes.length;
  if (!count) return { positions: [] as Positioned[], width: WIDTH, height: HEIGHT };

  const random = seeded(0x5eed);
  const index = new Map(nodes.map((node, i) => [node.id, i]));

  const x = new Float64Array(count);
  const y = new Float64Array(count);
  const vx = new Float64Array(count);
  const vy = new Float64Array(count);

  // Roster members start on an inner ring and candidates on an outer one, which
  // gives the simulation a sensible starting shape instead of a hairball.
  const pinnedCount = nodes.filter((node) => node.pinned).length || 1;
  const looseCount = count - pinnedCount || 1;
  let pinnedSeen = 0;
  let looseSeen = 0;

  nodes.forEach((node, i) => {
    if (node.pinned) {
      const angle = (pinnedSeen++ / pinnedCount) * Math.PI * 2;
      x[i] = WIDTH / 2 + Math.cos(angle) * 210 + (random() - 0.5) * 24;
      y[i] = HEIGHT / 2 + Math.sin(angle) * 165 + (random() - 0.5) * 24;
    } else {
      const angle = (looseSeen++ / looseCount) * Math.PI * 2;
      x[i] = WIDTH / 2 + Math.cos(angle) * 430 + (random() - 0.5) * 70;
      y[i] = HEIGHT / 2 + Math.sin(angle) * 330 + (random() - 0.5) * 70;
    }
  });

  const links = edges
    .map((edge) => ({ a: index.get(edge.source), b: index.get(edge.target) }))
    .filter((link): link is { a: number; b: number } => link.a !== undefined && link.b !== undefined);

  // Heavier nodes resist being pushed around, so well-known accounts settle near
  // the middle and the long tail arranges itself around them.
  const mass = nodes.map((node) => 1 + Math.log10(1 + node.weight) * 0.6);
  const radius = nodes.map((node) => node.radius);

  for (let step = 0; step < ITERATIONS; step += 1) {
    const cooling = 1 - step / ITERATIONS;

    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        let dx = x[i] - x[j];
        let dy = y[i] - y[j];
        let distanceSq = dx * dx + dy * dy;
        if (distanceSq < 0.01) {
          dx = (random() - 0.5) * 0.1;
          dy = (random() - 0.5) * 0.1;
          distanceSq = 0.01;
        }
        const distance = Math.sqrt(distanceSq);
        // Repulsion is scaled by the pair's combined size, so large circles clear
        // room proportional to the space they actually occupy on screen.
        const scale = (radius[i] + radius[j]) * 1.6;
        const force = (scale * scale * 15) / distanceSq;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        vx[i] += fx / mass[i];
        vy[i] += fy / mass[i];
        vx[j] -= fx / mass[j];
        vy[j] -= fy / mass[j];
      }
    }

    for (const link of links) {
      const dx = x[link.b] - x[link.a];
      const dy = y[link.b] - y[link.a];
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const rest = radius[link.a] + radius[link.b] + 118;
      const force = (distance - rest) * 0.011;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      vx[link.a] += fx / mass[link.a];
      vy[link.a] += fy / mass[link.a];
      vx[link.b] -= fx / mass[link.b];
      vy[link.b] -= fy / mass[link.b];
    }

    for (let i = 0; i < count; i += 1) {
      // Pull to centre, stronger vertically because the canvas is wider than it
      // is tall and nodes otherwise pile up along the top and bottom edges.
      vx[i] += (WIDTH / 2 - x[i]) * 0.010;
      vy[i] += (HEIGHT / 2 - y[i]) * 0.014;

      vx[i] *= 0.84 * cooling;
      vy[i] *= 0.84 * cooling;

      // Deliberately not clamped here. A hard clamp during the simulation makes
      // nodes stick to the wall they were pushed against instead of finding a
      // resting place; bounds are enforced once the forces have settled.
      x[i] += vx[i];
      y[i] += vy[i];
    }
  }

  // Hard separation. Overlapping circles are not just ugly here, they make the
  // node underneath impossible to click.
  for (let pass = 0; pass < COLLISION_PASSES; pass += 1) {
    let moved = false;
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        const dx = x[j] - x[i];
        const dy = y[j] - y[i];
        const minimum = radius[i] + radius[j] + NODE_GAP;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (distance >= minimum) continue;
        const push = (minimum - distance) / 2;
        const ux = dx / distance;
        const uy = dy / distance;
        x[i] -= ux * push;
        y[i] -= uy * push;
        x[j] += ux * push;
        y[j] += uy * push;
        moved = true;
      }
    }
    for (let i = 0; i < count; i += 1) {
      x[i] = Math.max(MARGIN, Math.min(WIDTH - MARGIN, x[i]));
      y[i] = Math.max(MARGIN, Math.min(HEIGHT - MARGIN, y[i]));
    }
    if (!moved) break;
  }

  return {
    positions: nodes.map((node, i) => ({ id: node.id, x: x[i], y: y[i] })),
    width: WIDTH,
    height: HEIGHT
  };
}

export type LabelInput = {
  id: string;
  text: string;
  x: number;
  y: number;
  radius: number;
  fontSize: number;
  /** Higher wins a contested spot. Roster members outrank candidates. */
  priority: number;
};

export type PlacedLabel = { id: string; x: number; y: number };

/**
 * Places as many labels as will fit without overlapping.
 *
 * A force layout says nothing about text, so labels drawn blindly above every
 * node collide constantly and the graph becomes unreadable. Each label is tried
 * above the node then below it, and is dropped if neither position is free.
 * Dropping a label is better than printing two on top of each other: the node is
 * still there, still coloured, and still shows its handle on hover.
 */
export function placeLabels(labels: LabelInput[]): PlacedLabel[] {
  const ordered = [...labels].sort((a, b) => b.priority - a.priority);
  const taken: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const placed: PlacedLabel[] = [];

  const overlaps = (box: { x1: number; y1: number; x2: number; y2: number }) =>
    taken.some(
      (other) =>
        box.x1 < other.x2 && box.x2 > other.x1 && box.y1 < other.y2 && box.y2 > other.y1
    );

  for (const label of ordered) {
    // Close enough for collision purposes at these font sizes.
    const width = label.text.length * label.fontSize * 0.56;
    const height = label.fontSize + 3;
    const half = width / 2;

    const candidates = [
      label.y - label.radius - 6,
      label.y + label.radius + height
    ];

    for (const y of candidates) {
      const box = { x1: label.x - half, y1: y - height, x2: label.x + half, y2: y + 2 };
      if (overlaps(box)) continue;
      taken.push(box);
      placed.push({ id: label.id, x: label.x, y });
      break;
    }
  }

  return placed;
}

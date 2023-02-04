import { quadtree, QuadtreeLeaf } from "d3-quadtree";
import {
  EnergyForce,
  EnergyLayout,
  Node,
  DiffNode,
  Metric,
  euclidean,
} from "./EnergyLayout";

export class Centering implements EnergyForce {
  _strength: (node: Node) => number = () => 1;
  _center: [number, number] = [0, 0];
  _radius = 200;
  _metric: Metric = euclidean;

  strength(strength: number | ((node: Node) => number)): this {
    if (typeof strength == "number") this._strength = () => strength;
    else this._strength = strength;
    return this;
  }

  center(cx: number, cy: number): this {
    this._center = [cx, cy];
    return this;
  }

  radius(radius: number): this {
    this._radius = radius;
    return this;
  }

  metric(metric: Metric): this {
    this._metric = metric;
    return this;
  }

  energy(layout: EnergyLayout): number {
    let energy = 0;
    layout._nodes.forEach((node) => {
      const strength = this._strength(node);
      const [r, [rx, ry]] = this._metric.distance(
        [node.x, node.y],
        this._center
      );
      const d = r - this._radius;
      if (d > 0.1) {
        energy += (strength * d * d) / 2;
        node.dx -= strength * rx;
        node.dy -= strength * ry;
      }
    });
    return energy;
  }
}

function softTub(x: number): [number, number] {
  return [
    Math.log(1 + Math.exp(10 * Math.abs(x * x) - 10)),
    (20 * x * Math.exp(10 * x * x - 10)) / (Math.exp(10 * x * x - 10) + 1),
  ];
}

export class OnScreen implements EnergyForce {
  _strength: (node: Node) => number = () => 1;
  _width = 500;
  _height = 500;
  _metric: Metric = euclidean;

  strength(strength: number | ((node: Node) => number)): this {
    if (typeof strength == "number") this._strength = () => strength;
    else this._strength = strength;
    return this;
  }

  width(width: number): this {
    this._width = width;
    return this;
  }

  height(height: number): this {
    this._height = height;
    return this;
  }

  energy(layout: EnergyLayout): number {
    let energy = 0;
    layout._nodes.forEach((node) => {
      const strength = this._strength(node);
      const fx = (node.x / this._width) * 2 - 1;
      const fy = (node.y / this._height) * 2 - 1;

      const [ex, dx] = softTub(fx);
      const [ey, dy] = softTub(fy);
      energy += strength * (ex + ey);
      node.dx += strength * dx;
      node.dy += strength * dy;
    });
    return energy;
  }
}

function point2rect(
  point: [number, number],
  rect: [number, number, number, number],
  metric: Metric
): number {
  const [x, y] = point;
  const [x0, y0, x1, y1] = rect;
  const xInside = x0 <= x && x <= x1;
  const yInside = y0 <= y && y <= y1;

  if (xInside && yInside) return 0;

  if (xInside)
    return Math.min(
      metric.distance(point, [x, y0])[0],
      metric.distance(point, [x, y1])[0]
    );
  if (yInside)
    return Math.min(
      metric.distance(point, [x0, y])[0],
      metric.distance(point, [x1, y])[0]
    );
  return Math.min(
    metric.distance(point, [x0, y0])[0],
    metric.distance(point, [x1, y0])[0],
    metric.distance(point, [x0, y1])[0],
    metric.distance(point, [x1, y1])[0]
  );
}

export class Charge implements EnergyForce {
  _maxDistance = 200;
  _charge: (node: Node) => number = () => 1;
  _linkCharge: (link: Link) => number = () => 1;
  _metric: Metric = euclidean;
  _links: Link[] = [];

  charge(charge: number | ((node: Node) => number)): this {
    if (typeof charge == "number") this._charge = () => charge;
    else this._charge = charge;
    return this;
  }

  linkCharge(linkCharge: number | ((link: Link) => number)): this {
    if (typeof linkCharge == "number") this._linkCharge = () => linkCharge;
    else this._linkCharge = linkCharge;
    return this;
  }

  maxDistance(distance: number): this {
    this._maxDistance = distance;
    return this;
  }

  metric(metric: Metric): this {
    this._metric = metric;
    return this;
  }

  links(links: Link[]): this {
    this._links = links;
    return this;
  }

  energy(layout: EnergyLayout): number {
    const tree = quadtree(
      layout._nodes,
      (d) => d.x,
      (d) => d.y
    );
    let energy = 0;
    let useless = 0;
    let prunes = 0;

    for (const node of layout._nodes) {
      const charge = this._charge(node);
      tree.visit((leaf, x0, y0, x1, y1) => {
        if (!leaf.length) {
          let endLeaf = leaf as QuadtreeLeaf<DiffNode> | undefined;
          while (endLeaf) {
            const other = endLeaf.data;
            if (other !== node) {
              const strength = charge * this._charge(other);
              const [r, [rx, ry]] = this._metric.distance(
                [other.x, other.y],
                [node.x, node.y]
              );
              const d = Math.max(5, r);
              if (d < this._maxDistance) {
                energy += strength / d;
                const d3 = d * d * d;
                node.dx -= (strength * rx) / d3;
                node.dy -= (strength * ry) / d3;
              } else {
                ++useless;
              }
            }
            endLeaf = endLeaf.next;
          }
        }

        const toEvaluate =
          point2rect([node.x, node.y], [x0, y0, x1, y1], this._metric) <
          this._maxDistance;

        if (!toEvaluate) ++prunes;
        return !toEvaluate;
      });
    }

    for (const link of this._links) {
      const charge = this._linkCharge(link);
      tree.visit((leaf, x0, y0, x1, y1) => {
        const midX = (link.source.x + link.target.x) / 2;
        const midY = (link.source.y + link.target.y) / 2;

        if (!leaf.length) {
          let endLeaf = leaf as QuadtreeLeaf<DiffNode> | undefined;
          while (endLeaf) {
            const other = endLeaf.data;
            if (other !== link.source && other !== link.target) {
              const strength = charge * this._charge(other);
              const [r, [rx, ry]] = this._metric.distance(
                [midX, midY],
                [other.x, other.y]
              );
              const d = Math.max(5, r);
              if (d < this._maxDistance) {
                energy += strength / d;
                const d3 = d * d * d;
                other.dx -= (strength * rx) / d3;
                other.dy -= (strength * ry) / d3;
              } else {
                ++useless;
              }
            }
            endLeaf = endLeaf.next;
          }
        }

        const toEvaluate =
          point2rect([midX, midY], [x0, y0, x1, y1], this._metric) <
          this._maxDistance;

        if (!toEvaluate) ++prunes;
        return !toEvaluate;
      });
    }

    return energy;
  }
}

export interface Link {
  source: Node;
  target: Node;
}

export class Links<L extends Link> implements EnergyForce {
  _links: L[] = [];
  _strength: (link: L) => number = () => 1;
  _length: (link: L) => number = () => 20;
  _metric: Metric = euclidean;

  links(links: L[]): this {
    this._links = links;
    return this;
  }

  strength(strength: number | ((link: L) => number)): this {
    if (typeof strength == "number") this._strength = () => strength;
    else this._strength = strength;
    return this;
  }

  length(length: number | ((link: L) => number)): this {
    if (typeof length == "number") this._length = () => length;
    else this._length = length;
    return this;
  }

  metric(metric: Metric): this {
    this._metric = metric;
    return this;
  }

  energy(): number {
    let energy = 0;
    this._links.forEach((link) => {
      const strength = this._strength(link);
      const [r, [rx1, ry1]] = this._metric.distance(
        [link.source.x, link.source.y],
        [link.target.x, link.target.y]
      );
      const [_, [rx2, ry2]] = this._metric.distance(
        [link.target.x, link.target.y],
        [link.source.x, link.source.y]
      );
      const d = r - this._length(link);
      energy += (d * d * strength) / 2;

      const src = link.source as DiffNode;
      const trg = link.target as DiffNode;
      src.dx -= (strength * d * rx1) / r;
      src.dy -= (strength * d * ry1) / r;
      trg.dx -= (strength * d * rx2) / r;
      trg.dy -= (strength * d * ry2) / r;
    });
    return energy;
  }
}

/* eslint-disable no-dupe-class-members */
import { dispatch } from "d3-dispatch";
import { timer, Timer } from "d3-timer";

export interface Metric {
  distance: (
    a: [number, number],
    b: [number, number]
  ) => [number, [number, number]];
}

export const euclidean: Metric = {
  distance: (
    [xSrc, ySrc]: [number, number],
    [xDest, yDest]: [number, number]
  ) => {
    const dx = xDest - xSrc;
    const dy = yDest - ySrc;
    return [Math.hypot(dx, dy), [dx, dy]];
  },
};

export interface EnergyForce {
  energy(layout: EnergyLayout): number;
}

export interface Node {
  x: number;
  y: number;
}

export interface DiffNode extends Node {
  dx: number;
  dy: number;
}

export class EnergyLayout {
  _forces: Map<string, EnergyForce> = new Map();
  _nodes: DiffNode[] = [];
  _gamma = 1;
  _stepper: Timer = timer(() => this._step());
  _energy = 0;
  _event = dispatch("tick", "end");

  _step(): void {
    // Reset derivative
    for (const node of this._nodes) node.dx = node.dy = 0;

    this._energy = 0;
    for (const force of this._forces.values()) {
      this._energy += force.energy(this);
    }

    for (const node of this._nodes) {
      node.x -= node.dx * this._gamma;
      node.y -= node.dy * this._gamma;
    }

    this._event.call("tick", this);
  }

  force(name: string): EnergyForce;
  force(name: string, force: EnergyForce | null): this;

  force(...args: unknown[]): unknown {
    if (args.length == 1) return this._forces.get(args[0] as string);
    if (args[1] === null) this._forces.delete(args[0] as string);
    else this._forces.set(args[0] as string, args[1] as EnergyForce);
    return this;
  }

  gamma(): number;
  gamma(gamma: number): this;

  gamma(gamma?: unknown): unknown {
    if (gamma == undefined) return this._gamma;
    this._gamma = gamma as number;
    return this;
  }

  nodes(nodes: Node[]): this {
    this._nodes = nodes as DiffNode[];
    return this;
  }

  on(name: string, func: null | ((t: this) => any)): this {
    this._event.on(name, func);
    return this;
  }

  restart(): this {
    this._stepper.restart(() => this._step());
    return this;
  }

  stop(): this {
    this._stepper.stop();
    return this;
  }
}

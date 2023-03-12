class Hex {
  q: number;
  r: number;
  constructor(q: number, r: number) {
    this.q = q;
    this.r = r;
  }
}

class OffsetCoord {
  col: number;
  row: number;
  constructor(col: number, row: number) {
    this.col = col;
    this.row = row;
  }
}

function axial2evenq(hex: Hex): OffsetCoord {
  var col = hex.q;
  var row = hex.r + (hex.q + (hex.q & 1)) / 2;
  return new OffsetCoord(col, row);
}

function evenq2axial(hex: OffsetCoord): Hex {
  var q = hex.col;
  var r = hex.row - (hex.col + (hex.col & 1)) / 2;
  return new Hex(q, r);
}

const evenqDirections = [
  // even cols
  [
    [+1, +1],
    [+1, 0],
    [0, -1],
    [-1, 0],
    [-1, +1],
    [0, +1],
  ],
  // odd cols
  [
    [+1, 0],
    [+1, -1],
    [0, -1],
    [-1, -1],
    [-1, 0],
    [0, +1],
  ],
];

function evenqOffsetNeighbor(hex: OffsetCoord, direction: number): OffsetCoord {
  var parity = hex.col & 1;
  var diff = evenqDirections[parity][direction];
  return new OffsetCoord(hex.col + diff[0], hex.row + diff[1]);
}

function axialDistance(a: Hex, b: Hex): number {
  return (
    (Math.abs(a.q - b.q) +
      Math.abs(a.q + a.r - b.q - b.r) +
      Math.abs(a.r - b.r)) /
    2
  );
}

function evenqDistance(a: OffsetCoord, b: OffsetCoord): number {
  return axialDistance(evenq2axial(a), evenq2axial(b));
}

function* axialInDistance(center: Hex, dist: number) {
  for (let i = -dist; i <= dist; i++) {
    for (let j = -dist; j <= dist; j++) {
      if (Math.abs(i + j) <= dist) {
        yield new Hex(center.q + i, center.r + j);
      }
    }
  }
}

function* evenqInDistance(center: OffsetCoord, dist: number) {
  let axial = axialInDistance(evenq2axial(center), dist);
  for (let hex of axial) {
    yield axial2evenq(hex);
  }
}

function* evenqInRing(center: OffsetCoord, dist: number) {
  if (dist === 0) {
    yield center;
  }
  let coord = center;
  for (let i = 0; i < dist; i++) {
    coord = evenqOffsetNeighbor(coord, 4);
  }
  for (let dir = 0; dir < 6; dir++) {
    for (let i = 0; i < dist; i++) {
      yield coord;
      coord = evenqOffsetNeighbor(coord, dir);
    }
  }
}

// Public API
export function neighbor(x: number, y: number, dir: number): [number, number] {
  let pos = new OffsetCoord(y, x);
  let neighbor = evenqOffsetNeighbor(pos, dir);
  return [neighbor.row, neighbor.col];
}

export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  let a = new OffsetCoord(y1, x1);
  let b = new OffsetCoord(y2, x2);
  return evenqDistance(a, b);
}

export function* inDistance(x: number, y: number, dist: number) {
  let axial = evenqInDistance(new OffsetCoord(y, x), dist);
  for (let hex of axial) {
    yield [hex.row, hex.col];
  }
}

export function* inRing(x: number, y: number, dist: number) {
  let axial = evenqInRing(new OffsetCoord(y, x), dist);
  for (let hex of axial) {
    yield [hex.row, hex.col];
  }
}

export function isIdxValid(x: number, y: number, mapLen: number): boolean {
  return distance(x, y, mapLen - 1, mapLen - 1) < mapLen;
}

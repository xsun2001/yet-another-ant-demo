export function genArray<T>(len: number, ele: (i: number) => T): T[] {
  return Array(len)
    .fill(0)
    .map((v, i) => ele(i));
}

export function twodimArray<T>(len: number, ele: (i: number, j: number) => T): T[][] {
  return genArray(len, (i) => genArray(len, (j) => ele(i, j)));
}

export function arrayEq<T>(a1: T[], a2: T[]): boolean {
  if (a1.length !== a2.length) return false;
  for (let i = 0; i < a1.length; i++) {
    if (a1[i] !== a2[i]) return false;
  }
  return true;
}

export function probabilityChoose(prob: number[]): number {
  if (Math.abs(prob.reduce((a, b) => a + b, 0) - 1) > 1e-6) {
    console.warn(`Invalid probability array: ${prob}`);
    return 0;
  }
  let rd = Math.random();
  for (let i = 0; i < prob.length; i++) {
    rd -= prob[i];
    if (rd < 0) {
      return i;
    }
  }
  return prob.length - 1;
}

export const renderConfig = {
  cellRadius: 20,
  offsetX: 50,
  offsetY: 50,
};

export function idx2pos(x: number, y: number): [number, number] {
  let posY = x * renderConfig.cellRadius * Math.sqrt(3) + renderConfig.offsetX;
  if (y % 2 == 0) {
    posY += (renderConfig.cellRadius * Math.sqrt(3)) / 2;
  }
  let posX = (1 + 1.5 * y) * renderConfig.cellRadius + renderConfig.offsetY;
  return [posX, posY];
}

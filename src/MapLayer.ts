import * as Coord from "./Coord";

interface IdPosData {
  id: number;
  x: number;
  y: number;
}

export class MapLayer<Data extends IdPosData> {
  data: Data[] = [];
  nextIdx: number = 0;
  getList(): Data[] {
    return this.data;
  }
  getByPredicate(pred: (data: Data) => boolean): Data[] {
    return this.data.filter(pred);
  }
  getById(id: number): Data[] {
    return this.getByPredicate((data) => data.id === id);
  }
  getByPos(x: number, y: number): Data[] {
    return this.getByPredicate((data) => data.x === x && data.y === y);
  }
  getByRange(x: number, y: number, range: number): Data[] {
    return this.data.filter((data) => Coord.distance(x, y, data.x, data.y) <= range);
  }
  push(...el: Data[]) {
    this.data.push(...el);
  }
  useNextIdx(): number {
    let idx = this.nextIdx;
    this.nextIdx += 1;
    return idx;
  }
}

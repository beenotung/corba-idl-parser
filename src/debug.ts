import {iolist} from './io';
import * as util from "util";

export function debugFormat(o: any[] | any, res: any[] = []): iolist[] {
  if (o === undefined) {
    return ['undefined'];
  }
  if (!Array.isArray(o)) {
    if (o.constructor) {
      res.push({class: o.constructor.name, value: o});
    } else {
      res.push(o);
    }
  }
  if (o.forEach) {
    o.forEach((x) => debugFormat(x, res));
  } else {
    res.push(o);
  }
  return res;
}

export function inspect(o) {
  return util.inspect(o, {
    colors: true,
    depth: 999,
  })
}

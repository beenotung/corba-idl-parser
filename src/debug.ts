import {iolist} from "./io";

export function debugFormat(o: any[] | any, res: any[] = []): iolist[] {
  if (!Array.isArray(o)) {
    if (o.constructor) {
      res.push({class: o.constructor.name, value: o})
    } else {
      res.push(o);
    }
  }
  if (o.forEach) {
    o.forEach(x => debugFormat(x, res));
  }
  else {
    res.push(o);
  }
  return res;
}

import * as fs from "fs";
import * as util from "util";

export async function readFile(filename: string) {
  const buffer = await util.promisify(fs.readFile)(filename);
  const text = buffer.toString();
  return text;
}

export type one_or_list<A> = A | Array<A>
export type iolist = one_or_list<string>

export function iolist_to_string(i: string | string[] | iolist): string {
  if (typeof i === "string") {
    return i;
  }
  return i.map(x => iolist_to_string(x)).join('')
}

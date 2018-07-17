import {config} from './config';
import {iolist, iolist_to_string, readFile} from './io';
import {Comment, Expr, Module, MultiLineComment, SingleLineComment, Space, Struct, Sym, TypeName,} from './term';
import {inspect} from "./debug";

abstract class Checker<Item> {
  constructor(public name: string) {
  }

  public checkAll(cs: any[], offset: number): Array<Item | any> {
    const ys: Array<Item | any> = [];
    for (; offset < cs.length;) {
      const res = this.check(cs, offset);
      if (res === false) {
        ys.push(cs[offset]);
        offset++;
      } else {
        let item: Item;
        [item, offset] = res;
        ys.push(item);
      }
    }
    return ys;
  }

  /** @return [Item, offset] */
  protected abstract check(cs: any[], offset: number): [Item, number] | false;
}

function not_supported(): any {
  throw new Error('not supported');
}

namespace Checker {
  export function create<Item>(name: string,
                               f: (cs: any[], offset: number) => [Item, number] | false,): Checker<Item> {
    class NewChecker extends Checker<Item> {
      public check(cs: any[], offset: number): [Item, number] | false {
        return f(cs, offset);
      }
    }

    return new NewChecker(name);
  }

  export function then<A, B>(a: Checker<A>, b: Checker<B>): Checker<A | B> {
    return thenAll<A | B>(a, b);
  }

  export function thenAll<A>(...checkers: Array<Checker<A>>): Checker<A> {
    const name = '(' + checkers.map((x) => x.name).join(' then ') + ')';

    class ThenAllChecker extends Checker<A> {
      public checkAll(cs: any[], offset: number): Array<A | any> {
        for (const checker of checkers) {
          cs = checker.checkAll(cs, offset);
          offset = 0;
        }
        return cs;
      }

      protected check(cs: any[], offset: number): [A, number] | false {
        return not_supported();
      }
    }

    return new ThenAllChecker(name);
  }
}

function isBetween<A>(l: A, m: A, r: A): boolean {
  return l <= m && m <= r;
}

function isEngChar(c: string) {
  return isBetween('a', c, 'z') || isBetween('A', c, 'Z');
}

function isNumChar(c: string) {
  return isBetween('0', c, '9');
}

function isWordHead(c: string) {
  return c === '_' || isEngChar(c);
}

function isWordBody(c: string) {
  return isWordHead(c) || isNumChar(c);
}

function isStopWord(c: string) {
  return !(
    c === '_' ||
    isBetween('0', c, '9') ||
    isBetween('a', c, 'z') ||
    isBetween('A', c, 'Z')
  );
}

function isSpace(c: string) {
  switch (c) {
    case ' ':
    case '\n':
    case '\r':
    case '\t':
      return true;
    default:
      return false;
  }
}

const spaceChecker = Checker.create<Space>('spaceChecker', (cs, offset) => mapTakeWhile(cs, offset, c => isSpace(c), ss => new Space(ss.join(''))));
/**@deprecated*/
const symChecker = Checker.create<Sym>('symChecker', (cs, offset) => {
  let c = cs[offset];
  switch (c) {
    case '<':
    case '>':
    case '{':
    case '}':
    case ';':
      return [new Sym(c), offset + 1];
    default:
      return false;
  }
});

function isSym(s: string, o) {
  return (o instanceof Sym) && o.value === s;
}

function startsWith<A>(cs: A[], offset: number, pattern: string | A[], eq = (a, b) => a === b): boolean {
  if (typeof pattern === 'string') {
    pattern = pattern.split('') as any;
  }
  for (let i = 0; i < pattern.length; i++) {
    if (!eq(cs[offset + i], pattern[i])) {
      return false;
    }
  }
  let next = cs[offset + pattern.length];
  return isStopWord(next as any);
}

class SingleLineCommentChecker extends Checker<SingleLineComment> {
  constructor() {
    super('SingleLineCommentChecker ');
  }

  public check(cs: string[],
               offset: number,): [SingleLineComment, number] | false {
    if (!startsWith(cs, offset, '//')) {
      return false;
    }
    offset += 2;
    let end = cs.indexOf('\n', offset);
    if (end === -1) {
      end = cs.length;
    }
    const comment = new SingleLineComment(
      iolist_to_string(cs.slice(offset, end)),
    );
    return [comment, end];
  }
}

class MultiLineChecker extends Checker<MultiLineComment> {
  constructor() {
    super('MultiLineChecker ');
  }

  public findEnd(cs: string[], offset: number) {
    for (; offset < cs.length;) {
      const idx = cs.indexOf('*', offset);
      if (idx === -1) {
        return -1;
      }
      if (cs[idx + 1] === '/') {
        return idx - 1;
      }
      offset = idx + 1;
    }
    return -1;
  }

  public check(cs: string[],
               offset: number,): [MultiLineComment, number] | false {
    if (!startsWith(cs, offset, '/*')) {
      return false;
    }
    offset += 2;
    const end = this.findEnd(cs, offset);
    if (end === -1) {
      return false;
    }
    const comment = new MultiLineComment(
      iolist_to_string(cs.slice(offset, end)),
    );
    return [comment, end + 2];
  }
}

class Block extends Expr {
  constructor(public body: Expr[]) {
    super();
  }

  public toIDLString(): iolist {
    return undefined;
  }
}

class BlockChecker extends Checker<Block> {
  constructor() {
    super('BlockChecker');
  }

  public check(cs: any[], offset: number): [Block, number] | false {
    return undefined;
  }

  public checkAll(cs: any[], offset: number): Array<Block | any> {
    for (; ;) {
      const start = cs.lastIndexOf('{');
      if (start === -1) {
        return cs;
      }
      const end = cs.indexOf('}', start);
      if (end === -1) {
        throw new Error('Block is not closed, `}` not found.');
      }
      const body = cs.slice(start + 1, end);
      const pre = cs.slice(0, start);
      const post = cs.slice(end + 1, cs.length);
      const res = [];
      res.push(...pre);
      res.push(new Block(exprChecker.checkAll(body, 0)));
      res.push(...post);
      return res;
    }
  }
}

class ModuleChecker extends Checker<Module> {
  constructor() {
    super('ModuleChecker');
  }

  public check(cs: any[], offset: number): [Module, number] | false {
    if (startsWith(cs, offset, 'module')) {
      offset += 'module'.length;
      const end = cs.indexOf('{', offset);
      if (end === -1) {
        throw new Error('Failed to parse module, `{` not found.');
      }
      const name = cs
        .slice(offset, end - 1)
        .join('')
        .trim();
      offset = end + 1;
    }
    return undefined;
  }
}

function takeWhile<A>(xs: A[],
                      offset: number,
                      p: (a: A) => boolean,): [A[], number] | false {
  const yx: A[] = [];
  for (; offset < xs.length;) {
    if (p(xs[offset])) {
      yx.push(xs[offset]);
      offset++;
    } else {
      break;
    }
  }
  if (yx.length === 0) {
    return false;
  } else {
    return [yx, offset];
  }
}

function mapTakeWhile<A, B>(xs: A[], offset: number, p: (a: A) => boolean, m: (xs: A[]) => B): [B, number] | false {
  let res = takeWhile(xs, offset, p);
  if (res === false) {
    return false
  }
  let ys: A[];
  [ys, offset] = res;
  return [m(ys), offset];
}

class CodeChecker extends Checker<Expr> {
  constructor() {
    super('CodeChecker');
  }

  public check(cs: string[], offset: number): [Expr, number] | false {
    const c = cs[offset];
    if (typeof c === 'string' && false) {
      console.error({
        offset,
        current: c,
        line: cs.slice(offset, cs.indexOf('\n', offset)).join(''),
      });
      throw new Error('unknown pattern');
    }
    if (typeof c === 'string') {
      return [new Sym(c), offset + 1];
    } else {
      return false;
    }
  }
}

function genSeqChecker<Item>(name: string, seq: string | any[], eq = (a, b) => a === b): Checker<void> {
  if (typeof seq === 'string') {
    seq = seq.split('');
  }
  return Checker.create(name, (cs, offset) => {
    startsWith(cs, offset, seq)
    for (let i = 0; i < seq.length; i++) {
      if (!eq(cs[offset + i], seq[i])) {
        return false;
      }
    }
    return [void 0, offset + seq.length]
  })
}

class Word extends Expr {
  constructor(public value: string) {
    super()
  }

  toIDLString(): iolist {
    return this.value;
  }
}

const wordChecker = Checker.create('wordChecker', (cs, offset) => {
  let acc = cs[offset];
  if (!isWordHead(acc)) {
    return false;
  }
  offset++;
  for (; ;) {
    let c = cs[offset];
    if (isWordBody(c)) {
      acc += c;
      offset++;
    } else {
      break
    }
  }
  return [new Word(acc), offset]
});

function isWord(s: string, o) {
  return (o instanceof Word) && o.value === s;
}

function takeBodyFunc<A>(p: (a: A) => boolean, cs: A[], offset: number, body: any[]): [A, number] {
  let last;
  for (; offset < cs.length;) {
    let c = cs[offset];
    last = c;
    body.push(c);
    if ((c instanceof Space) || (c instanceof Comment)) {
      offset++;
      continue;
    }
    if (p(c)) {
      return [c, offset + 1];
    }
    offset++
  }
  console.error({
    offset,
    last,
    body,
  });
  throw new Error('unexpected body item')
}

function takeBodyForClass<A>(targetClass, cs: A[], offset: number, body: any[]): [A, number] {
  try {
    return takeBodyFunc(a => a instanceof targetClass, cs, offset, body);
  } catch (e) {
    console.error({
      targetClass: targetClass.name,
    });
    throw e;
  }
}

function takeBodyForSym(sym: string, cs: any[], offset: number, body: any[]): [Sym, number] {
  let s: string;
  [s, offset] = takeBodyFunc(o => (o instanceof Sym && o.value === sym) || o as any === sym, cs, offset, body);
  s = body.pop();
  const symbol = new Sym(s);
  body.push(symbol);
  return [symbol, offset]
}

class StructBody extends Expr {
  constructor(public fields: TypeName[], public body: Expr[]) {
    super()
  }

  toIDLString(): iolist {
    return this.body.map(x => x.toIDLString())as iolist;
  }
}

const structFieldChecker = Checker.create('structFieldChecker', (cs, offset) => {
  const body: Expr[] = [];
  const fields: TypeName[] = [];

  for (; offset < cs.length;) {
    const c = cs[offset];
    body.push(c);
    if ((c instanceof Space) || (c instanceof Comment)) {
      offset++;
      continue;
    }
    /**
     * name: last Word
     * type: other Words
     * */
    let typeNameBody: Expr[] = [];
    let sym: Sym;
    [sym, offset] = takeBodyForSym(';', cs, offset, typeNameBody);

    let words = typeNameBody.filter(x => x instanceof Word);
    if (words.length < 2) {
      console.error({
        offset,
        c,
        words,
      });
      throw new Error('incomplete typename')
    }
    let name = words.pop();
    let type = words;
    console.log({
      name,
      type,
    });
    // TODO
    throw new Error('test here')
  }

  return [new StructBody(fields, body), offset];
});

const structChecker = Checker.create('structChecker', (cs, offset) => {
  const body: Expr[] = [];
  if (!isWord('struct', cs[offset])) {
    return false;
  }
  body.push(cs[offset]);
  offset++;

  /* take name */
  let name: Word;
  [name, offset] = takeBodyForClass(Word, cs, offset, body);

  /* take block */
  let block: Block;
  [block, offset] = takeBodyForClass(Block, cs, offset, body);

  let fields = structFieldChecker.checkAll(block.body, 0);
  console.log('fields:', inspect(fields));

  /* take ';' */
  let sym: Sym;
  [sym, offset] = takeBodyForSym(';', cs, offset, body);

  return [new Struct(name.value, fields, body), offset]
});

const exprChecker = Checker.thenAll(
  new MultiLineChecker(),
  new SingleLineCommentChecker(),
  spaceChecker,
  wordChecker,
  // symChecker,
  new BlockChecker(),
  structChecker,
  new CodeChecker(),
);

export async function parseIDLFile(filename: string): Promise<Expr[]> {
  if (!filename.endsWith('.idl')) {
    console.warn('input file should be .idl', {filename});
  }
  console.log(`reading ${filename}...`);
  let exprs: Expr[];
  if (config.dev) {
    const text = await readFile(filename);
    const ss = text.split('');
    for (let i = 0; i < ss.length; i++) {
      console.debug(i + ': ' + JSON.stringify(ss[i]));
    }
    exprs = exprChecker.checkAll(ss, 0);
  } else {
    exprs = exprChecker.checkAll((await readFile(filename)).split(''), 0);
  }
  return exprs;
}

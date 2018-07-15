import {Expr, Module, MultiLineComment, Name, SingleLineComment, Space, Type, TypeDef} from "./term";
import {iolist, iolist_to_string} from "./io";

interface ParseResult<Char, Item> {
  remind: Char[];
  offset: number;
  result: Item;
}

abstract class Parser<Char, Item> {
  constructor(public name: string) {
  }

  public abstract parse(xs: Char[], offset: number): Array<ParseResult<Char, Item>>;
}

namespace Parser {
  export function run<Char, Item>(xs: Char[], offset: number, parser: Parser<Char, Item>): ParseResult<Char, Item> {
    const res = parser.parse(xs, offset);
    if (res.length !== 1) {
      console.error('result:', res);
      throw new Error("expect one result");
    }
    return res[0];
  }

  export function then<Char, A, B>(parserA: Parser<Char, A>, parserB: Parser<Char, B>): Parser<Char, [A, B]> {
    class ParserC extends Parser<Char, [A, B]> {
      parse(xs: Char[], offset: number): Array<ParseResult<Char, [A, B]>> {
        const res: ParseResult<Char, [A, B]>[] = [];
        for (const resA of parserA.parse(xs, offset)) {
          for (const resB of parserB.parse(resA.remind, resA.offset)) {
            res.push({
              remind: resB.remind,
              offset: resB.offset,
              result: [resA.result, resB.result]
            });
          }
        }
        return res;
      }
    }

    return new ParserC(`(${parserA.name} then ${parserB.name})`);
  }

  export function or<Char, A, B>(parserA: Parser<Char, A>, parserB: Parser<Char, B>): Parser<Char, A | B> {
    class ParserOr extends Parser<Char, A | B> {
      parse(xs: Char[], offset: number): Array<ParseResult<Char, A | B>> {
        const resA = parserA.parse(xs, offset);
        if (resA.length > 0) {
          return resA;
        }
        return parserB.parse(xs, offset);
      }
    }

    return new ParserOr(`(${parserA.name} or ${parserB.name})`)
  }

  export function orAll<Char, Item>(...parsers: Array<Parser<Char, Item>>): Parser<Char, Item> {
    let acc = parsers.shift();
    for (; ;) {
      let c = parsers.shift();
      if (c) {
        acc = or(acc, c);
      } else {
        break
      }
    }
    return acc;
  }

  export function map<Char, A, B>(parser: Parser<Char, A>, f: (a: A) => B, name?: string): Parser<Char, B> {
    class ParserB extends Parser<Char, B> {
      parse(xs: Char[], offset: number): Array<ParseResult<Char, B>> {
        return parser.parse(xs, offset).map(res => ({
          remind: res.remind,
          offset: res.offset,
          result: f(res.result)
        }));
      }
    }

    if (name) {
      name = `map of ${parser.name} to ${name}`
    } else {
      name = `map of ${parser.name}`
    }
    return new ParserB(`(${name})`);
  }

  export function thenAll<Char, Item>(...parsers: Array<Parser<Char, Item>>): Parser<Char, Item[]> {
    let acc = map(parsers.shift(), x => [x]);
    for (; ;) {
      let parser = parsers.shift();
      if (parser) {
        acc = map(then(acc, parser), ([xs, x]) => [...xs, x])
      } else {
        break
      }
    }
    return acc;
  }

  export function branch<Char, Item>(predictor: (xs: Char[], offset: number) => boolean,
                                     thenParser: Parser<Char, Item>,
                                     elseParser: Parser<Char, Item>): Parser<Char, Item> {
    class BranchParser extends Parser<Char, Item> {
      parse(xs: Char[], offset: number): Array<ParseResult<Char, Item>> {
        if (predictor(xs, offset)) {
          return thenParser.parse(xs, offset)
        } else {
          return elseParser.parse(xs, offset)
        }
      }
    }

    return new BranchParser(`BranchParser(${thenParser.name} else ${elseParser.name})`)
  }

  export function repeat<Char, Item>(parser: Parser<Char, Item>): Parser<Char, Item[]> {
    class ParserRepeat extends Parser<Char, Item[]> {
      parse(xs: Char[], offset: number): Array<ParseResult<Char, Item[]>> {
        let res = run(xs, offset, parser);
        const items: Item[] = [res.result];
        for (; res.remind.length > 0;) {
          res = run(res.remind, res.offset, parser);
          items.push(res.result);
        }
        return [{
          remind: res.remind,
          offset: res.offset,
          result: items,
        }];
      }
    }

    return new ParserRepeat(`(repeat ${parser.name})`)
  }
}

class FailureParser extends Parser<any, any> {
  constructor(public reason: string) {
    super("FailureParser")
  }

  parse(xs: any[]): Array<ParseResult<any, any>> {
    return [];
  }
}

class SuccessParser<Char, Item> extends Parser<Char, Item> {
  constructor(public item: Item) {
    super(`SuccessParser(${item})`)
  }

  parse(xs: Char[], offset: number): Array<ParseResult<Char, Item>> {
    return [{
      remind: xs,
      offset,
      result: this.item,
    }];
  }

}

class CharParser<Char extends string> extends Parser<string, Char> {
  constructor(public char: Char) {
    super(`CharParser(${char})`);
  }

  parse(xs: string[], offset: number): Array<ParseResult<string, Char>> {
    if (xs[offset] === this.char) {
      return [{
        remind: xs,
        offset: offset + 1,
        result: this.char,
      }]
    }
    return [];
  }
}

class CharSeqParser<Str extends string> extends Parser<string, Str> {
  constructor(public str: Str) {
    super(`CharSeqParser(${str})`)
  }

  parse(xs: string[], offset: number): Array<ParseResult<string, Str>> {
    for (let i = 0; i < this.str.length; i++) {
      if (xs[offset + i] !== this.str[i]) {
        return [];
      }
    }
    return [{
      remind: xs,
      offset: offset + this.str.length,
      result: this.str,
    }]
  }
}

class IntegerParser extends Parser<string, number> {
  constructor() {
    super("IntegerParser")
  }

  static isDigit(c: string) {
    switch (c) {
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        return true;
      default:
        return false;
    }
  }

  static toDigit(c: string) {
    return c.charCodeAt(0) - 48;
  }

  parse(xs: string[], offset: number): Array<ParseResult<string, number>> {
    let c = xs[offset];
    if (!IntegerParser.isDigit(c)) {
      return [];
    }
    let acc = IntegerParser.toDigit(c);
    offset++;
    for (; offset < xs.length;) {
      let c = xs[offset];
      if (!IntegerParser.isDigit(c)) {
        break;
      }
      acc = acc * 10 + IntegerParser.toDigit(c);
      offset++;
    }
    return [{
      remind: xs,
      offset,
      result: acc
    }]
  }
}

const integerParser = new IntegerParser();

class DigitParser extends Parser<string, string> {
  constructor() {
    super("DigitParser ")
  }

  parse(xs: string[], offset: number): Array<ParseResult<string, string>> {
    let c = xs[offset];
    if ('0' <= c && c <= '9') {
      return [{
        remind: xs,
        offset: offset + 1,
        result: c
      }]
    } else {
      return []
    }
  }
}

const digitParser = new DigitParser();

class EngCharParser extends Parser<string, string> {
  constructor() {
    super("EngCharParser ")
  }

  parse(xs: string[], offset: number): Array<ParseResult<string, string>> {
    let c = xs[offset];
    if (!c) {
      return []
    }
    c = c.toUpperCase();
    if (!('A' <= c && c <= 'Z')) {
      return []
    }
    return [{
      remind: xs,
      offset: offset + 1,
      result: c
    }];
  }
}

const engCharParser = new EngCharParser();

const wordHeadParser = engCharParser;
Parser.orAll(
  engCharParser,
  new CharParser('_'),
);
const wordBodyParser = Parser.repeat(Parser.or(wordHeadParser, digitParser));
const wordParser = Parser.or(
  Parser.then(wordHeadParser, wordBodyParser),
  wordHeadParser
);

class SpaceTermParser extends Parser<string, Space> {
  constructor() {
    super("SpaceParser")
  }

  parse(xs: string[], offset: number): Array<ParseResult<string, Space>> {
    let acc = 0;
    for (; offset < xs.length;) {
      if (xs[offset] === ' ') {
        offset++;
        acc++;
      } else {
        break
      }
    }
    return [{
      remind: xs,
      offset,
      result: new Space(acc)
    }];
  }
}

const spaceTermParser = new SpaceTermParser();

const spaceCharParser = new CharParser(' ');
// at least one space
const spaceParser = Parser.orAll(
  spaceCharParser,
  Parser.map(Parser.repeat(spaceCharParser), xs => iolist_to_string(xs)),
);

interface TypeName {
  type: Type
  name: Name
}

const ordNumTypeParser = Parser.orAll(
  new CharSeqParser('short'),
  new CharSeqParser('long long'),
  new CharSeqParser('long'),
);
const realNumTypeParser = Parser.orAll(
  new CharSeqParser('float'),
  new CharSeqParser('double'),
  new CharSeqParser('fixed'),
);
const numTypeParser = Parser.orAll(
  ordNumTypeParser,
  Parser.map(Parser.then(new CharSeqParser('unsigned '), ordNumTypeParser), ([a, b]) => a + b),
  realNumTypeParser
);

const typeBodyParser = Parser.or(numTypeParser, wordParser);
const typeParser = Parser.or(
  Parser.thenAll(
    new CharSeqParser('sequence'),
    new CharParser('<'),
    typeBodyParser,
    new CharParser('>'),
  ),
  typeBodyParser
);
const typeNameParser = Parser.map(
  Parser.thenAll(
    new CharSeqParser('typedef'),
    spaceParser,
    typeParser,
    spaceParser,
    wordParser,
    spaceParser,
    new CharParser(';')
  ),
  ([_t1, _s1, type, _s2, name]) => {
    // const typeTerm = new Type(iolist_to_string(type as iolist));
    // const nameTerm = new Name(iolist_to_string(name as iolist));
    return new TypeDef(
      iolist_to_string(type as iolist),
      iolist_to_string(name as iolist),
    )
  }
  )
;

class TypeNameParser extends Parser<string, TypeName> {
  constructor(public stopChar: string) {
    super(`TypeNameParser(${stopChar})`)
  }

  parse(xs: string[], offset: number): Array<ParseResult<string, TypeName>> {
    return undefined;
  }
}

const typeDefParser = Parser.thenAll(
  new CharSeqParser('typedef '),
);


class SingleLineCommentParser extends Parser<string, SingleLineComment> {
  constructor() {
    super("SingleLineCommentParser")
  }

  parse(xs: string[], offset: number): Array<ParseResult<string, SingleLineComment>> {
    if (!(xs[offset] === '/' && xs[offset + 1] === '/')) {
      return []
    }
    offset += 2;
    let acc = '';
    for (; offset < xs.length;) {
      let c = xs[offset];
      if (c === '\n') {
        offset++;
        break;
      } else {
        acc += c;
        offset++;
      }
    }
    return [{
      remind: xs,
      offset,
      result: new SingleLineComment(acc)
    }]
  }
}

class MultiLineCommentParser extends Parser<string, MultiLineComment> {
  constructor() {
    super("MultiLineCommentParser ")
  }

  parse(xs: string[], offset: number): Array<ParseResult<string, MultiLineComment>> {
    if (!(xs[offset] === '/' && xs[offset + 1] === '*')) {
      return []
    }
    offset += 2;
    let acc = '';
    for (; offset < xs.length;) {
      let c = xs[offset];
      if (c === '*' && xs[offset + 1] === '/') {
        offset += 2;
        break
      } else {
        acc += c;
        offset++;
      }
    }
    return [{
      remind: xs,
      offset,
      result: new MultiLineComment(acc)
    }]
  }
}

class NameParser extends Parser<string, Name> {
  constructor() {
    super("NameParser ")
  }

  parse(xs: string[], offset: number): Array<ParseResult<string, Name>> {
    return undefined;
  }
}

class ModuleParser extends Parser<string, Module> {
  constructor() {
    super("ModuleParser ")
  }

  parse(xs: string[], offset: number): Array<ParseResult<string, Module>> {
    return undefined;
  }
}

const moduleParser = Parser.thenAll(
  new CharSeqParser("module "),
  new Name
)
const exprParser: Parser<string, Expr> = Parser.orAll(

);
const fileParser: Parser<string, Expr> = Parser.repeat(exprParser);

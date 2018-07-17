import {
  Define, Expr, FixString, IfNDef, Include, Module, MultiLineComment, Name, NumberType, Sequence,
  SingleLineComment, Space, Struct, Type, TypeDef, VarString
} from "./term";
import {iolist, iolist_to_string, readFile} from "./io";
import {config} from "./config";

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
    console.debug(`(${offset}/${xs.length})`, 'run', parser.name, `[${xs[offset]}]`);
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

  export function orAll<Char, A1>(p1: Parser<Char, A1>): Parser<Char, A1>
  export function orAll<Char, A1, A2>(p1: Parser<Char, A1>, p2: Parser<Char, A2>): Parser<Char, A1 | A2>
  export function orAll<Char, A1, A2, A3>(p1: Parser<Char, A1>, p2: Parser<Char, A2>, p3: Parser<Char, A3>): Parser<Char, A1 | A2 | A3>
  export function orAll<Char, A1, A2, A3, A4>(p1: Parser<Char, A1>, p2: Parser<Char, A2>, p3: Parser<Char, A3>, p4: Parser<Char, A4>): Parser<Char, A1 | A2 | A3 | A4>
  export function orAll<Char, A1, A2, A3, A4, A5>(p1: Parser<Char, A1>, p2: Parser<Char, A2>, p3: Parser<Char, A3>, p4: Parser<Char, A4>, p5: Parser<Char, A5>): Parser<Char, A1 | A2 | A3 | A4 | A5>
  export function orAll<Char, A1, A2, A3, A4, A5, A6>(p1: Parser<Char, A1>, p2: Parser<Char, A2>, p3: Parser<Char, A3>, p4: Parser<Char, A4>, p5: Parser<Char, A5>, p6: Parser<Char, A6>): Parser<Char, A1 | A2 | A3 | A4 | A5 | A6>
  export function orAll<Char, A1, A2, A3, A4, A5, A6, A7>(p1: Parser<Char, A1>, p2: Parser<Char, A2>, p3: Parser<Char, A3>, p4: Parser<Char, A4>, p5: Parser<Char, A5>, p6: Parser<Char, A6>, p7: Parser<Char, A7>): Parser<Char, A1 | A2 | A3 | A4 | A5 | A6 | A7>
  export function orAll<Char, A1, A2, A3, A4, A5, A6, A7, A8>(p1: Parser<Char, A1>, p2: Parser<Char, A2>, p3: Parser<Char, A3>, p4: Parser<Char, A4>, p5: Parser<Char, A5>, p6: Parser<Char, A6>, p7: Parser<Char, A7>, p8: Parser<Char, A8>): Parser<Char, A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8>
  export function orAll<Char, A1, A2, A3, A4, A5, A6, A7, A8, A9>(p1: Parser<Char, A1>, p2: Parser<Char, A2>, p3: Parser<Char, A3>, p4: Parser<Char, A4>, p5: Parser<Char, A5>, p6: Parser<Char, A6>, p7: Parser<Char, A7>, p8: Parser<Char, A8>, p9: Parser<Char, A9>): Parser<Char, A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A9>

  export function orAll<Char, Item>(...parsers: Array<Parser<Char, Item>>): Parser<Char, Item> ;
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

  export function thenAll<Char, A1>(p1: Parser<Char, A1>): Parser<Char, [A1]>
  export function thenAll<Char, A1, A2>(p1: Parser<Char, A1>, p2: Parser<Char, A2>): Parser<Char, [A1, A2]>
  export function thenAll<Char, A1, A2, A3>(p1: Parser<Char, A1>, p2: Parser<Char, A2>, p3: Parser<Char, A3>): Parser<Char, [A1, A2, A3]>
  export function thenAll<Char, A1, A2, A3, A4>(p1: Parser<Char, A1>, p2: Parser<Char, A2>, p3: Parser<Char, A3>, p4: Parser<Char, A4>): Parser<Char, [A1, A2, A3, A4]>
  export function thenAll<Char, A1, A2, A3, A4, A5>(p1: Parser<Char, A1>, p2: Parser<Char, A2>, p3: Parser<Char, A3>, p4: Parser<Char, A4>, p5: Parser<Char, A5>): Parser<Char, [A1, A2, A3, A4, A5]>
  export function thenAll<Char, A1, A2, A3, A4, A5, A6>(p1: Parser<Char, A1>, p2: Parser<Char, A2>, p3: Parser<Char, A3>, p4: Parser<Char, A4>, p5: Parser<Char, A5>, p6: Parser<Char, A6>): Parser<Char, [A1, A2, A3, A4, A5, A6]>
  export function thenAll<Char, A1, A2, A3, A4, A5, A6, A7>(p1: Parser<Char, A1>, p2: Parser<Char, A2>, p3: Parser<Char, A3>, p4: Parser<Char, A4>, p5: Parser<Char, A5>, p6: Parser<Char, A6>, p7: Parser<Char, A7>): Parser<Char, [A1, A2, A3, A4, A5, A6, A7]>
  export function thenAll<Char, A1, A2, A3, A4, A5, A6, A7, A8>(p1: Parser<Char, A1>, p2: Parser<Char, A2>, p3: Parser<Char, A3>, p4: Parser<Char, A4>, p5: Parser<Char, A5>, p6: Parser<Char, A6>, p7: Parser<Char, A7>, p8: Parser<Char, A8>): Parser<Char, [A1, A2, A3, A4, A5, A6, A7, A8]>
  export function thenAll<Char, A1, A2, A3, A4, A5, A6, A7, A8, A9>(p1: Parser<Char, A1>, p2: Parser<Char, A2>, p3: Parser<Char, A3>, p4: Parser<Char, A4>, p5: Parser<Char, A5>, p6: Parser<Char, A6>, p7: Parser<Char, A7>, p8: Parser<Char, A8>, p9: Parser<Char, A9>): Parser<Char, [A1, A2, A3, A4, A5, A6, A7, A8, A9]>

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

  export function isValid<Char, Item>(xs: Char[], offset: number, parser: Parser<Char, Item>): boolean {
    return parser.parse(xs, offset).length !== 0;
  }

  export function repeat<Char, Item>(parser: Parser<Char, Item>): Parser<Char, Item[]> {
    class ParserRepeat extends Parser<Char, Item[]> {
      parse(xs: Char[], offset: number): Array<ParseResult<Char, Item[]>> {
        const result: Item[] = [];
        for (; offset < xs.length;) {
          if (isValid(xs, offset, parser)) {
            const res = run(xs, offset, parser);
            xs = res.remind;
            offset = res.offset;
            result.push(res.result)
          } else {
            break
          }
        }
        return [{
          remind: xs,
          offset,
          result
        }];
      }
    }

    return new ParserRepeat(`(repeat ${parser.name})`)
  }

  export function repeatUntil<Char, A, B>(bodyParser: Parser<Char, A>,
                                          tailParser: Parser<Char, B>): Parser<Char, [A[], B]> {
    class ParserRepeatUtil extends Parser<Char, [A[], B]> {
      parse(xs: Char[], offset: number): Array<ParseResult<Char, [A[], B]>> {
        console.debug(`(${offset}/${xs.length})`, 'repeat', bodyParser.name, 'until', tailParser.name, `[${xs[offset]}]`);
        const as: A[] = [];
        for (; offset < xs.length;) {
          if (isValid(xs, offset, tailParser)) {
            break;
          }
          const resA = run(xs, offset, bodyParser);
          xs = resA.remind;
          offset = resA.offset;
          as.push(resA.result);
        }
        const res: ParseResult<Char, [A[], B]>[] = [];
        tailParser.parse(xs, offset).map(resB => res.push({
          remind: resB.remind,
          offset: resB.offset,
          result: [as, resB.result]
        }));
        return res;
      }
    }

    return new ParserRepeatUtil(`ParserRepeatUtil(${bodyParser.name} until ${tailParser.name})`)
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

class AnyCharParser<Char> extends Parser<Char, Char> {
  constructor() {
    super('AnyCharParser')
  }

  parse(xs: Char[], offset: number): Array<ParseResult<Char, Char>> {
    if (offset < xs.length) {
      return [{
        remind: xs,
        offset: offset + 1,
        result: xs[offset],
      }]
    }
    return []
  }
}

const anyCharParser = new AnyCharParser<any>();

function isBetween<A>(l: A, m: A, r: A): boolean {
  return l <= m && m <= r;
}

function isStopChar(c: string): boolean {
  return !(
    c === '_'
    || isBetween('a', c, 'z')
    || isBetween('A', c, 'Z')
    || isBetween('0', c, '9')
  );
}

class StopCharParser extends Parser<string, void> {
  constructor() {
    super('StopCharParser ')
  }

  parse(xs: string[], offset: number): Array<ParseResult<string, void>> {
    if (Parser.isValid(xs, offset, wordBodyParser)) {
      return []
    }
    return [{
      remind: xs,
      offset,
      result: void 0
    }]
  }
}

class CharSeqParser<Str extends string> extends Parser<string, Str> {
  constructor(public str: Str) {
    super(`CharSeqParser(${str})`)
  }

  parse(xs: string[], offset: number): Array<ParseResult<string, Str>> {
    // console.debug(this.name, {
    //   offset,
    //   c: xs[offset],
    //   name: this.name,
    // });
    for (let i = 0; i < this.str.length; i++) {
      if (xs[offset + i] !== this.str[i]) {
        return [];
      }
    }
    offset += this.str.length;
    if (!isStopChar(xs[offset])) {
      console.debug(`not stop char: '${xs[offset]}'`);
      if(config.dev){
        throw new Error("check here")
      }
      return [];
    }
    return [{
      remind: xs,
      offset: offset,
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
    const C = c.toUpperCase();
    if (!('A' <= C && C <= 'Z')) {
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

const wordHeadParser = Parser.orAll(
  engCharParser,
  new CharParser('_'),
);
wordHeadParser.name = 'wordHeadParser';
const wordBodyParser = Parser.repeat(Parser.or(wordHeadParser, digitParser));
wordBodyParser.name = 'wordBodyParser';
const wordParser: Parser<string, string> = Parser.map(Parser.or(
  Parser.then(wordHeadParser, wordBodyParser),
  wordHeadParser
), ss => iolist_to_string(ss as iolist));
wordParser.name = 'wordParser';

const spaceCharParser = Parser.orAll(
  new CharParser(' '),
  new CharParser('\n'),
  new CharParser('\r'),
  new CharParser('\t'),
);
spaceCharParser.name = 'spaceCharParser';
// at least one space
const spaceParser = Parser.orAll(
  spaceCharParser,
  Parser.map(Parser.repeat(spaceCharParser), xs => iolist_to_string(xs)),
);
spaceParser.name = 'spaceParser';
const spaceTermParser = Parser.map(
  spaceParser,
  s => new Space(s.length),
);
spaceTermParser.name = 'spaceTermParser';

const maybeSpaceParser = Parser.or(
  spaceParser,
  new SuccessParser('')
);
maybeSpaceParser.name = 'maybeSpaceParser';

interface TypeName {
  type: Type
  name: Name
}

const ordNumTypeParser = Parser.orAll(
  new CharSeqParser('short'),
  new CharSeqParser('long long'),
  new CharSeqParser('long'),
);
ordNumTypeParser.name = 'ordNumTypeParser';
const realNumTypeParser = Parser.orAll(
  new CharSeqParser('float'),
  new CharSeqParser('double'),
  new CharSeqParser('fixed'),
);
realNumTypeParser.name = 'realNumTypeParser';
const numTypeParser = Parser.map(Parser.orAll(
  ordNumTypeParser,
  Parser.map(Parser.then(new CharSeqParser('unsigned'), ordNumTypeParser), ([a, b]) => a + b),
  realNumTypeParser
  ),
  num => new NumberType(num)
);
numTypeParser.name = 'numTypeParser';

const fixStringTypeParser = Parser.map(
  Parser.thenAll(
    new CharSeqParser('string'),
    maybeSpaceParser,
    new CharParser('<'),
    maybeSpaceParser,
    integerParser,
    maybeSpaceParser,
    new CharParser('>'),
    maybeSpaceParser,
  ),
  ([_s, _s1, _c1, _s2, int]) => new FixString(int)
);
fixStringTypeParser.name = 'fixStringTypeParser';
const varStringTypeParser = Parser.map(
  new CharSeqParser('string'),
  s => new VarString()
);
varStringTypeParser.name = 'varStringTypeParser';

const stringTypeParser = Parser.orAll(
  fixStringTypeParser,
  varStringTypeParser,
);
stringTypeParser.name = 'stringTypeParser';

const typeBodyParser = Parser.orAll(numTypeParser,
  stringTypeParser,
  Parser.map(wordParser, s => new Type(s)),
);
typeBodyParser.name = 'typeBodyParser';

const sequenceTypeParser = Parser.map(
  Parser.thenAll(
    new CharSeqParser('sequence'),
    new CharParser('<'),
    typeBodyParser,
    new CharParser('>'),
  ),
  ([_s, _c1, body]) => new Sequence(body)
);
sequenceTypeParser.name = 'sequenceTypeParser';

const typeParser = Parser.or(
  sequenceTypeParser,
  typeBodyParser,
);
typeParser.name = 'typeParser';
const typeDefParser = Parser.map(
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
      type,
      iolist_to_string(name as iolist),
    )
  }
);
typeDefParser.name = 'typeDefParser';

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

const singleLineCommentParser = new SingleLineCommentParser();
singleLineCommentParser.name = 'singleLineCommentParser';

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

const multiLineCommentParser = new MultiLineCommentParser();
multiLineCommentParser.name = 'multiLineCommentParser';
const commentParser = Parser.or(singleLineCommentParser, multiLineCommentParser);
commentParser.name = 'commentParser';

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

    const headParser = Parser.map(
      Parser.thenAll(
        new CharSeqParser('module'),
        spaceParser,
        wordParser,
        maybeSpaceParser,
        new CharParser('{'),
      ),
      ([_module, _s1, name]) => ({name})
    );

    const bodyParser = exprParser;

    // todo support the comments
    const tailParser = Parser.thenAll(
      new CharParser('}'),
      maybeSpaceParser,
      new CharParser(';'),
    );

    const parser = Parser.map(
      Parser.then(
        headParser,
        Parser.repeatUntil(bodyParser, tailParser)
      ),
      ([head, [bodies]]) => new Module(head.name, bodies)
    );

    return parser.parse(xs, offset);
  }
}

const moduleParser = new ModuleParser();


const structHeadParser = Parser.map(
  Parser.thenAll(
    new CharSeqParser('struct'),
    spaceParser,
    wordParser,
    maybeSpaceParser,
    new CharParser('{'),
  ),
  ([_struct, _s1, name]) => ({name})
);
structHeadParser.name = 'headParser';

const structFieldParser = Parser.map(
  Parser.thenAll(
    typeParser,
    spaceParser,
    wordParser,
    maybeSpaceParser,
    new CharParser(';')
  ),
  ([type, _s1, name]) => ({type, name: new Name(name)} as TypeName)
);
structFieldParser.name = 'structFieldParser';

// TODO support comment
const structBodyItemParser = Parser.orAll(
  Parser.map(structFieldParser, s => [s] as TypeName[]),
  Parser.map(commentParser, () => [] as TypeName[]),
  Parser.map(spaceParser, () => [] as TypeName[]),
);
structBodyItemParser.name = 'structBodyItemParser';

const structBodyParser = structBodyItemParser;
/*
const structBodyParser =
  Parser.map(
    Parser.repeat(structBodyItemParser),
    xss => {
      const res: TypeName[] = [];
      xss.forEach(xs => xs.forEach(x => res.push(x)));
      return res;
    }
  );
  */
structBodyParser.name = 'structBodyParser';

const structTailParser = Parser.thenAll(
  new CharParser('}'),
  maybeSpaceParser,
  new CharParser(';'),
);
structTailParser.name = 'structTailParser';

const structParser = Parser.map(
  Parser.thenAll(
    structHeadParser,
    Parser.repeatUntil(structBodyParser, structTailParser)
  ),
  ([head, [bodies]]) => {
    const bs_: TypeName[] = [];
    bodies.forEach(bs => bs.forEach(b => bs_.push(b)));
    return new Struct(head.name, bs_);
  }
);
structParser.name = 'structParser';

const defineParser = Parser.map(
  Parser.thenAll(
    new CharSeqParser('#define'),
    spaceParser,
    wordParser,
    spaceParser,
  )
  , ([_define, _s, name]) => new Define(name)
);
defineParser.name = 'defineParser';

class IfNDefParser extends Parser<string, IfNDef> {
  constructor() {
    super('IfNDefParser ')
  }

  parse(xs: string[], offset: number): Array<ParseResult<string, IfNDef>> {
    const headParser = Parser.map(
      Parser.thenAll(
        new CharSeqParser('#ifndef'),
        spaceParser,
        wordParser,
      ),
      ([_ifndef, _s, name]) => ({name}));
    const bodyParser = exprParser;
    const tailParser = new CharSeqParser('#endif');
    const parser = Parser.map(
      Parser.then(
        headParser,
        Parser.repeatUntil(bodyParser, tailParser)
      ),
      ([head, [bodies]]) => new IfNDef(head.name, bodies));
    return parser.parse(xs, offset);
  }
}

const ifNDefParser = new IfNDefParser();

const includeParser = Parser.map(
  Parser.thenAll(
    new CharSeqParser('#include'),
    spaceParser,
    new CharParser('"'),
    Parser.repeatUntil(anyCharParser, new CharParser('"')),
    spaceParser,
  ),
  ([_define, _s, _sym, name_iolist]) => new Include(iolist_to_string(name_iolist as iolist))
  )
;
includeParser.name = 'includeParser';

function startsWith(xs: string[], offset: number, target: string) {
  for (let i = 0; i < target.length; i++) {
    if (xs[offset + i] !== target[i]) {
      return false
    }
  }
  return true;
}

class ExprParser extends Parser<string, Expr> {
  constructor() {
    super("ExprParser")
  }

  parse(xs: string[], offset: number): Array<ParseResult<string, Expr>> {
    console.debug({
      c: xs[offset],
      c1: xs[offset + 1],
      c2: xs[offset + 2],
    });
    if (startsWith(xs, offset, 'module')) {
      return moduleParser.parse(xs, offset);
    }
    if (startsWith(xs, offset, 'typedef')) {
      return typeDefParser.parse(xs, offset);
    }
    if (startsWith(xs, offset, 'struct')) {
      return structParser.parse(xs, offset)
    }
    if (startsWith(xs, offset, '//')) {
      return singleLineCommentParser.parse(xs, offset)
    }
    if (startsWith(xs, offset, '/*')) {
      return multiLineCommentParser.parse(xs, offset)
    }
    if (startsWith(xs, offset, '#ifndef')) {
      return ifNDefParser.parse(xs, offset)
    }
    if (Parser.isValid(xs, offset, spaceTermParser)) {
      return spaceTermParser.parse(xs, offset)
    }
    console.error({
      offset,
      char: xs[offset],
    });
    throw new Error('not impl pattern');
  }
}

// const exprParser = new ExprParser();
const exprParser = Parser.orAll(
  defineParser,
  includeParser,
  ifNDefParser,
  moduleParser,
  typeDefParser,
  structParser,
  singleLineCommentParser,
  multiLineCommentParser,
  spaceTermParser,
);
exprParser.name = 'exprParser';
const fileParser = Parser.repeat(exprParser);
fileParser.name = 'fileParser';

export async function parseIDLFile(filename: string): Promise<Expr[]> {
  if (!filename.endsWith('.idl')) {
    console.warn('input file should be .idl', {filename});
  }
  console.log(`reading ${filename}...`);
  let parseResults: ParseResult<string, Expr[]>[];
  if (config.dev) {
    let text = await readFile(filename);
    let ss = text.split('');
    for (let i = 0; i < ss.length; i++) {
      console.debug(i + ': ' + JSON.stringify(ss[i]));
    }
    parseResults = fileParser.parse(ss, 0);
  } else {
    parseResults = fileParser.parse((await readFile(filename)).split(''), 0);
  }
  if (parseResults.length !== 1) {
    console.error({parseResults});
    throw new Error(`Failed to parse file ${filename}`)
  }
  let res = parseResults[0];
  if (res.offset != res.remind.length) {
    console.error({
      len: res.remind.length,
      offset: res.offset,
      current: res.remind[res.offset],
      filename,
    });
    throw new Error(`File ${filename} is not fully parsed`);
  }
  return res.result;
}

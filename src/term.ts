import {iolist} from "./io";

export abstract class Expr {
  abstract toIDLString(): iolist;
}

export class Space extends Expr {
  constructor(public nSpace: number) {
    super()
  }

  toIDLString() {
    return ' '
  }
}

export class Newline extends Expr {
  toIDLString() {
    return '\n'
  }
}

export class SingleLineComment extends Expr {
  constructor(public value: string) {
    super()
  }

  toIDLString() {
    return [
      '//',
      this.value,
      '\n',
    ]
  }
}

export class MultiLineComment extends Expr {
  constructor(public value: string) {
    super()
  }

  toIDLString() {
    return [
      '/*',
      this.value,
      '*/',
    ]
  }
}

export class Name extends Expr {
  constructor(public value: string) {
    super()
  }

  toIDLString() {
    return this.value
  }
}

export class Sym extends Expr {
  value: string;

  toIDLString() {
    return this.value
  }
}

export class Type extends Expr {
  constructor(public value: string) {
    super()
  }

  toIDLString() {
    return this.value
  }
}

export class VarString extends Type {
  value = 'string'
}

export class FixString extends Type {
  constructor(public length: string) {
    super();
    this.value = `string<${length}>`;
  }
}

export class Module extends Expr {
  name: string;
  body: Expr[] = [];

  toIDLString(): iolist {
    return ['module ',
      this.name,
      '{',
      this.body.map(x => x.toIDLString()) as any,
      '};',
    ];
  }
}

export class TypeDef extends Expr {
  constructor(public type: string, public name: string) {
    super();
  }

  toIDLString() {
    return [
      'typedef ',
      this.type, ' ',
      this.name,
      ';',
    ]
  }
}

export class Struct extends Expr {
  name: string;
  body: Expr[] = [];

  toIDLString() {
    return [
      'struct ',
      this.name,
      '{',
      this.body.map(x => x.toIDLString()) as any,
      '};',
    ]
  }
}

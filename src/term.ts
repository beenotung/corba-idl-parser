import {iolist} from './io';

export abstract class Expr {
  public abstract toIDLString(): iolist;
}

export class Space extends Expr {
  constructor(public content: string) {
    super();
  }

  public toIDLString() {
    return this.content;
  }
}

export class Newline extends Expr {
  public toIDLString() {
    return '\n';
  }
}

export abstract class Comment extends Expr {
}

export class SingleLineComment extends Comment {
  constructor(public value: string) {
    super();
  }

  public toIDLString() {
    return ['//', this.value, '\n'];
  }
}

export class MultiLineComment extends Comment {
  constructor(public value: string) {
    super();
  }

  public toIDLString() {
    return ['/*', this.value, '*/'];
  }
}

export class Name extends Expr {
  constructor(public value: string) {
    super();
  }

  public toIDLString() {
    return this.value;
  }
}

export class Sym extends Expr {
  constructor(public value: string) {
    super();
  }

  public toIDLString() {
    return this.value;
  }
}

export class Type extends Expr {
  constructor(public value: string) {
    super();
  }

  public toIDLString() {
    return this.value;
  }
}

export abstract class StringType extends Type {
}

export class VarString extends StringType {
  constructor() {
    super('string');
  }
}

export class FixString extends StringType {
  constructor(public length: number) {
    super(`string<${length}>`);
  }
}

export class NumberType extends Type {
}

export class Sequence extends Type {
  constructor(public type: Type) {
    super(`sequence<${type.value}>`);
  }
}

export class Module extends Expr {
  constructor(public name: string, public body: Expr[] = []) {
    super();
  }

  public toIDLString(): iolist {
    return [
      'module ',
      this.name,
      '{',
      this.body.map((x) => x.toIDLString()) as any,
      '};',
    ];
  }
}

export class TypeDef extends Expr {
  constructor(public type: Type, public name: string) {
    super();
  }

  public toIDLString() {
    return ['typedef ', this.type.toIDLString(), ' ', this.name, ';'];
  }
}

export interface TypeName {
  type: Type;
  name: Name;
}

// TODO support comments
export class Struct extends Expr {
  constructor(public name: string, public fields: TypeName[], public body: Expr[]) {
    super();
  }

  public toIDLString() {
    return this.body.map(x => x.toIDLString()) as iolist;
  }
}

export abstract class Macro extends Expr {
}

export class Define extends Macro {
  constructor(public name: string) {
    super();
  }

  public toIDLString() {
    return ['#define ', this.name, '\n'];
  }
}

export class IfNDef extends Macro {
  constructor(public name: string, public body: Expr[]) {
    super();
  }

  public toIDLString(): iolist {
    return [
      '#ifndef ',
      this.name,
      '\n',
      this.body.map((x) => x.toIDLString()),
      '\n',
      '#endif',
      '\n',
    ] as iolist;
  }
}

export class Include extends Macro {
  constructor(public filename: string) {
    super();
  }

  public toIDLString() {
    return ['#include ', this.filename, '\n'];
  }
}

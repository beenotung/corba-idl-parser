import {parseIDLFile} from "../src/parser";
import {Expr, Module, MultiLineComment, SingleLineComment, Space, Struct, TypeDef} from "../src/term";

interface IDLJson {
  type: string
  name?: string
  value?: string
  children?: IDLJson[]
}

function exprToJson(e: Expr): IDLJson {
  if (e instanceof Module) {
    return {
      type: 'module',
      name: e.name,
      children: e.body.map(x => exprToJson(x))
    }
  }
  if (e instanceof TypeDef) {
    return {
      type: 'typedef',
      name: e.name,
      value: e.type.value,
    }
  }
  if (e instanceof SingleLineComment) {
    return {
      type: 'single line comment',
      value: e.value,
    }
  }
  if (e instanceof MultiLineComment) {
    return {
      type: 'multiple line comment',
      value: e.value,
    }
  }
  if (e instanceof Struct) {
    return {
      type: 'struct',
      name: e.name,
      children: e.fields.map(e => ({
        type: 'field',
        name: e.name.value,
        value: e.type.value,
      }))
    }
  }
  if (e instanceof Space) {
    return {type: 'space'}
  }
  console.error(e);
  throw new Error("unknown pattern")
}

function clean(xs: IDLJson[]): IDLJson[] {
  return xs
    .filter(x => x.type !== "space")
    .map(x => x.children
      ? ({...x, children: clean(x.children)})
      : x
    )
}

async function main() {
  const exprs = await parseIDLFile('./examples/idl/data.idl')
  let jsons = exprs.map(x => exprToJson(x));
  jsons = clean(jsons);
  const text = JSON.stringify(jsons, undefined, 2);
  console.log(text);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1)
  });

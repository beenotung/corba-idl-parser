import {parseIDLFile} from "./parser";
import {config} from "./config";
import {debugFormat} from "./debug";

async function main() {
  if (process.argv.length !== 3) {
    console.error('Error: expect 1 argument of IDL filename.');
    return process.exit(1);
  }
  const filename = process.argv[2];
  const exprs = await parseIDLFile(filename);
  if (config.dev) {
    console.debug(exprs);
    console.debug(JSON.stringify(exprs));
    let iolist = exprs.map(expr => expr.toIDLString());
    console.debug(iolist);
    console.debug(debugFormat(iolist));
  }
  console.log("ok.");
  process.exit(0);
}

main().then((e) => {
  console.error(e);
  process.exit(1);
});

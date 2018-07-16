import {parseFile} from "./parser";
import {debugFormat} from "./debug";

async function main() {
  if (process.argv.length !== 3) {
    console.error('Error: expect 1 argument of IDL filename.');
    return process.exit(1);
  }
  const filename = process.argv[2];
  const res = await parseFile(filename);
  console.debug(res);
  const expr = res[0].result;
  console.debug(JSON.stringify(expr));
  console.debug(expr.toIDLString());
  console.debug(debugFormat(expr.toIDLString()));
  console.log("ok.");
  process.exit(0);
}

main().then((e) => {
  console.error(e);
  process.exit(1);
});

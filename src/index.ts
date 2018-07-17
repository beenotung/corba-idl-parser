import {parseIDLFile} from './parser';
import {inspect} from "./debug";

async function main() {
  if (process.argv.length !== 3) {
    console.error('Error: expect 1 argument of IDL filename.');
    return process.exit(1);
  }
  const filename = process.argv[2];
  const exprs = await parseIDLFile(filename);
  console.log(inspect(exprs));
  console.log('ok.');
  process.exit(0);
}

main().then((e) => {
  console.error(e);
  process.exit(1);
});

export async function transpileFile (filename: string) {
  if (!filename.endsWith('.idl')) {
    console.warn('input file should be .idl');
  }
  console.log(`reading ${filename}...`);
}

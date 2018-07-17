function genThenAll(n: number) {
  let idx = [];
  for (let i = 1; i <= n; i++) {
    idx.push(i);
  }
  let ts = idx.map(i => `A${i}`).join(", ");
  let ps = idx.map(i => `p${i}: Parser<Char, A${i}>`).join(", ");
  return `export function thenAll<Char,${ts}>(${ps}):Parser<Char,[${ts}]>`;
}

function genOrAll(n: number) {
  let idx = [];
  for (let i = 1; i <= n; i++) {
    idx.push(i);
  }
  let ts = idx.map(i => `A${i}`).join(", ");
  let tsOr = idx.map(i => `A${i}`).join("|");
  let ps = idx.map(i => `p${i}: Parser<Char, A${i}>`).join(", ");
  return `export function orAll<Char,${ts}>(${ps}):Parser<Char,${tsOr}>`;
}

for (let i = 1; i < 10; i++) {
  console.log(genOrAll(i));
}

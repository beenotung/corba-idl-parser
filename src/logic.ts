export function permutate<X, Y, Z> (
  xs: X[],
  ys: Y[],
  f: (x: X, y: Y) => Z,
): Z[] {
  const zs: Z[] = [];
  for (const x of xs) {
    for (const y of ys) {
      zs.push(f(x, y));
    }
  }
  return zs;
}

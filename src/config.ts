export namespace config {
  export let dev = true;
  if (!dev) {
    console.debug = () => {
    }
  }
}

const modules = import.meta.glob("./*.js", {
  eager: true,
});

const allProducts = [];

for (const [filePath, module] of Object.entries(modules)) {
  // allProducts.js ni skip cheyyali
  if (filePath.endsWith("/allProducts.js")) {
    continue;
  }

  for (const value of Object.values(module)) {
    if (Array.isArray(value)) {
      allProducts.push(...value);
    }
  }
}

export { allProducts };
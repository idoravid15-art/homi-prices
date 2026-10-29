# homi-prices

The basket prices the kiny app compares, from the chains' public price files.

- **main**: what the app reads, rebuilt every morning as one commit with no history.
- **build** (default branch): the code that builds it, `.github/workflows/prices.yml`.

`app/prices.js`, `app/basket.js` and `parser/shopping.js` are copies of the app's own
files. The app's tests fail when they differ, so a change to either goes to both.
Nothing here reads or stores anything of a family.

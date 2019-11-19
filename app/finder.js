/* eslint generator-star-spacing: ["error", {"before": false, "after": true}] */
/* eslint yield-star-spacing: ["error", "after"] */
/* eslint-env es6 */
function finder () {
  const { resolve } = require('path')
  const { readdir } = require('fs').promises

  async function* getFiles (dir) {
    try {
      const dirents = await readdir(dir, { withFileTypes: true })

      for (const dirent of dirents) {
        const res = resolve(dir, dirent.name)
        if (dirent.isDirectory()) {
          yield* getFiles(res)
        } else {
          yield res
        }
      }
    } catch (error) {
      yield ''
    }
  }

  /* (async () => {
    for await (const f of getFiles('C:\\git\\thepisode\\beat\\src\\core')) {
      console.log(f)
    }
  })() */

  return {
    getFiles
  }
}

module.exports = finder

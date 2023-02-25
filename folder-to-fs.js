const path = require('path');
const zlib = require('zlib');
const fs = require('fs');
let loop = (dirname) => {
  let dirtree = {};
  let dir = fs.readdirSync(dirname);
  dir.forEach((x) => {
    let joined = path.join(dirname, x);
    let isF = fs.statSync(joined).isFile();
    if (isF) {
      dirtree[x] = {
        file: {
          contents: fs.readFileSync(joined).toString(),
        },
      };
    } else {
      dirtree[x] = {
        directory: loop(joined),
      };
    }
  });

  return dirtree;
};

fs.writeFileSync(
  process.argv[3],
  zlib.gzipSync(
    JSON.stringify(loop(process.argv[2]))
  )
);

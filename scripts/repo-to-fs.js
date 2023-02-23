const path = require('path');
const zlib = require('zlib');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
let ffs = require('memfs');
ffs = ffs.fs;
let repo = process.argv[2];
const rand = () => {
    return [0, 0, 0, 0, 0, 0, 0, 0, 0]
        .map(() => {
            let ran = 97 + Math.floor(Math.random() * 20);
            return ran > 111 ?
                String.fromCharCode(ran).toUpperCase() :
                String.fromCharCode(ran);
        })
        .join('');
};
let compr = (arr) => {
    return arr.map((x, i) => {
        if (i !== 0) {
            return x - arr[i - 1];
        } else {
            return x;
        }
    });
};
const dir = '/' + rand();
const fs = require('fs');
git
    .clone({
        fs: ffs,
        http,
        dir,
        url: repo,
    })
    .then(async () => {
        let loop = (dirname) => {
            // dirname = random string
            let dirtree = {};
            let adir = ffs.readdirSync(dirname);
            adir.forEach((x) => {
                let isF = ffs.statSync(path.join(dirname, x)).isFile();
                if (isF) {
                    dirtree[x] = {
                        file: {
                            contents: ffs.readFileSync(path.join(dirname, x)).toString(),
                        },
                    };
                } else {
                    dirtree[x] = {
                        directory: loop(path.join(dirname, x)),
                    };
                }
            });

            return dirtree;
        };
        fs.writeFileSync(process.argv[3], zlib.gzipSync(JSON.stringify(loop(dir))));
    })
    .catch((x) => console.log(x));

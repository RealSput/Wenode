# Wenode
[WebContainers](https://webcontainers.io), except it's a million times easier to use.

# Demo URL
https://wenode.seven7four4.repl.co (hosted on Replit to be able to use SharedArrayBuffers)
# Example
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Wenode</title>
</head>
<body>
  <iframe id="webserver"></iframe>
  <file name="index.html">
    <h1> Hello, World! </h1>
  </file>
  <script type="wenode" packages="express" client="#webserver" id="wn-sc">
    const express = require('express');
    const app = express();
    app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
    app.listen(8080, () => {
      console.log("Listening at :8080");
    });
  </script>
  <script src="wenode.js" type="text/javascript"></script>
</body>
</html>
 ```
# Setup
- Download one of Wenode distributions from [dist/](./dist) and place it in webserver
- Configure headers so WebContainers API works
  - `Cross-Origin-Embedder-Policy: require-corp`
  - `Cross-Origin-Opener-Policy: same-origin`
- Start webserver

# Usage
- The `file` tag
  - This tag is used to store text in a file before running code.
  - Usage:
    - `<file name="file_name_here.txt"> Hello, world! </file>`
- The `script[type=wenode]` tag
  - This tag is used for running code directly.
  - Usage:
    - `<script type="wenode" packages="express chalk" (Optional) no-autostart (Optional) client="#my-iframe-id" (Optional) esm (Optional)> console.log("Hello. world!"); </script>`
  - Events:
    - `onserver` (Activated when port opened)
    - `oninstall` (Activated on successful installation)
    - `oninstallfail` (Activated on failed installation) 
    - `onoutput` (Activated on output, only callback that returns a parameter) 
  - Functions
    - `wenode_elem.run()` - runs a non-automatically executing script
- The `fs` tag
  - A tag which has a file system already set up, so no installation or fetching is required, which speeds things up by a lot
  - Usage: `<fs src="node_modules.bin"></fs>`
    - Files are generated using the [create-node-modules](scripts/create-node-modules.js) and [repo-to-fs](scripts/repo-to-fs.js) scripts
    - Usage of the scripts: 
      - `node create-node-modules node_modules.bin`
      - `node repo-to-fs https://github.com/expressjs/express expressjs.bin`

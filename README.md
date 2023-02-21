# Wenode
WebContainers, except it's a million times easier to use.

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

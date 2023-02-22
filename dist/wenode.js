function decompress(byteArray) {
  const cs = new DecompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(byteArray);
  writer.close();
  return new Response(cs.readable).arrayBuffer().then(function (arrayBuffer) {
    return new TextDecoder().decode(arrayBuffer);
  });
}
// WEBCONTAINER CODE STARTS HERE
var proxyMarker = Symbol('Comlink.proxy');
var createEndpoint = Symbol('Comlink.endpoint');
var releaseProxy = Symbol('Comlink.releaseProxy');
var throwMarker = Symbol('Comlink.thrown');
var isObject = (val) =>
  (typeof val === 'object' && val !== null) || typeof val === 'function';
var proxyTransferHandler = {
  canHandle: (val) => isObject(val) && Boolean(val[proxyMarker]),
  serialize(obj) {
    const { port1, port2 } = new MessageChannel();
    const options = obj[proxyMarker];
    expose(obj, port1, typeof options === 'object' ? options : void 0);
    return [port2, [port2]];
  },
  deserialize(port) {
    port.start();
    return wrap(port);
  },
};
var throwTransferHandler = {
  canHandle: (value) => isObject(value) && throwMarker in value,
  serialize({ value }) {
    let serialized;
    if (value instanceof Error) {
      serialized = {
        isError: true,
        value: {
          message: value.message,
          name: value.name,
          stack: value.stack,
        },
      };
    } else {
      serialized = {
        isError: false,
        value,
      };
    }
    return [serialized, []];
  },
  deserialize(serialized) {
    if (serialized.isError) {
      throw Object.assign(
        new Error(serialized.value.message),
        serialized.value
      );
    }
    throw serialized.value;
  },
};
var transferHandlers = /* @__PURE__ */ new Map([
  ['proxy', proxyTransferHandler],
  ['throw', throwTransferHandler],
]);

function expose(obj, ep = self, options) {
  ep.addEventListener('message', function callback(ev) {
    if (!ev || !ev.data) {
      return;
    }
    const { id, type, path } = Object.assign(
      {
        path: [],
      },
      ev.data
    );
    const argumentList = (ev.data.argumentList || []).map(fromWireValue);
    let returnValue;
    try {
      const unrestricted =
        (options === null || options === void 0 ? void 0 : options.spec) ==
        null;
      let parent = obj;
      let rawValue = obj;
      let spec = options === null || options === void 0 ? void 0 : options.spec;
      let parentSpec = spec;
      for (const component of path) {
        parent = rawValue;
        parentSpec = spec;
        if (unrestricted) {
          rawValue = rawValue[component];
          continue;
        }
        if (typeof spec === 'object' && spec.hasOwnProperty(component)) {
          rawValue = rawValue[component];
          spec = spec[component];
        } else {
          rawValue = void 0;
          spec = void 0;
          break;
        }
      }
      switch (type) {
        case 0:
          {
            returnValue = rawValue;
          }
          break;
        case 1:
          {
            returnValue = false;
            const set =
              (options === null || options === void 0
                ? void 0
                : options.set) !== false;
            const allowed =
              unrestricted ||
              parentSpec === 'primitive' ||
              spec === 'primitive';
            if (!allowed) {
              parent = void 0;
            }
            if (set || !allowed) {
              parent[path.slice(-1)[0]] = fromWireValue(ev.data.value);
              returnValue = true;
            }
          }
          break;
        case 2:
          {
            if (!(unrestricted || spec === 'function')) {
              rawValue = void 0;
            }
            returnValue = rawValue.apply(parent, argumentList);
          }
          break;
        case 3:
          {
            if (!unrestricted) {
              rawValue = void 0;
            }
            const value = new rawValue(...argumentList);
            returnValue = proxy(value);
          }
          break;
        case 4:
          {
            const { port1, port2 } = new MessageChannel();
            expose(obj, port2, options);
            returnValue = transfer(port1, [port1]);
          }
          break;
        case 5:
          {
            returnValue = void 0;
          }
          break;
      }
    } catch (value) {
      returnValue = {
        value,
        [throwMarker]: 0,
      };
    }
    Promise.resolve(returnValue)
      .catch((value) => {
        return {
          value,
          [throwMarker]: 0,
        };
      })
      .then((returnValue2) => {
        const [wireValue, transferables] = toWireValue(returnValue2);
        ep.postMessage(
          Object.assign(Object.assign({}, wireValue), {
            id,
          }),
          transferables
        );
        if (type === 5) {
          ep.removeEventListener('message', callback);
          closeEndPoint(ep);
        }
      });
  });
  if (ep.start) {
    ep.start();
  }
}

function isMessagePort(endpoint) {
  return endpoint.constructor.name === 'MessagePort';
}

function closeEndPoint(endpoint) {
  if (isMessagePort(endpoint)) endpoint.close();
}

function wrap(ep, target) {
  return createProxy(ep, [], target);
}

function throwIfProxyReleased(isReleased) {
  if (isReleased) {
    throw new Error('Proxy has been released and is not useable');
  }
}

function createProxy(ep, path = [], target = function () {}) {
  let isProxyReleased = false;
  const proxy2 = new Proxy(target, {
    get(_target, prop) {
      throwIfProxyReleased(isProxyReleased);
      if (prop === releaseProxy) {
        return () => {
          return requestResponseMessage(ep, {
            type: 5,
            path: path.map((p) => p.toString()),
          }).then(() => {
            closeEndPoint(ep);
            isProxyReleased = true;
          });
        };
      }
      if (prop === 'then') {
        if (path.length === 0) {
          return {
            then: () => proxy2,
          };
        }
        const r = requestResponseMessage(ep, {
          type: 0,
          path: path.map((p) => p.toString()),
        }).then(fromWireValue);
        return r.then.bind(r);
      }
      return createProxy(ep, [...path, prop]);
    },
    set(_target, prop, rawValue) {
      throwIfProxyReleased(isProxyReleased);
      const [value, transferables] = toWireValue(rawValue);
      return requestResponseMessage(
        ep,
        {
          type: 1,
          path: [...path, prop].map((p) => p.toString()),
          value,
        },
        transferables
      ).then(fromWireValue);
    },
    apply(_target, _thisArg, rawArgumentList) {
      throwIfProxyReleased(isProxyReleased);
      const last = path[path.length - 1];
      if (last === createEndpoint) {
        return requestResponseMessage(ep, {
          type: 4,
        }).then(fromWireValue);
      }
      if (last === 'bind') {
        return createProxy(ep, path.slice(0, -1));
      }
      const [argumentList, transferables] = processArguments(rawArgumentList);
      return requestResponseMessage(
        ep,
        {
          type: 2,
          path: path.map((p) => p.toString()),
          argumentList,
        },
        transferables
      ).then(fromWireValue);
    },
    construct(_target, rawArgumentList) {
      throwIfProxyReleased(isProxyReleased);
      const [argumentList, transferables] = processArguments(rawArgumentList);
      return requestResponseMessage(
        ep,
        {
          type: 3,
          path: path.map((p) => p.toString()),
          argumentList,
        },
        transferables
      ).then(fromWireValue);
    },
  });
  return proxy2;
}

function myFlat(arr) {
  return Array.prototype.concat.apply([], arr);
}

function processArguments(argumentList) {
  const processed = argumentList.map(toWireValue);
  return [processed.map((v) => v[0]), myFlat(processed.map((v) => v[1]))];
}
var transferCache = /* @__PURE__ */ new WeakMap();

function transfer(obj, transfers) {
  transferCache.set(obj, transfers);
  return obj;
}

function proxy(obj, options) {
  return Object.assign(obj, {
    [proxyMarker]: options !== null && options !== void 0 ? options : true,
  });
}

function toWireValue(value) {
  for (const [name, handler] of transferHandlers) {
    if (handler.canHandle(value)) {
      const [serializedValue, transferables] = handler.serialize(value);
      return [
        {
          type: 3,
          name,
          value: serializedValue,
        },
        transferables,
      ];
    }
  }
  return [
    {
      type: 0,
      value,
    },
    transferCache.get(value) || [],
  ];
}

function fromWireValue(value) {
  switch (value.type) {
    case 3:
      return transferHandlers.get(value.name).deserialize(value.value);
    case 0:
      return value.value;
  }
}

function requestResponseMessage(ep, msg, transfers) {
  return new Promise((resolve) => {
    const id = generateUUID();
    ep.addEventListener('message', function l(ev) {
      if (!ev.data || !ev.data.id || ev.data.id !== id) {
        return;
      }
      ep.removeEventListener('message', l);
      resolve(ev.data);
    });
    if (ep.start) {
      ep.start();
    }
    ep.postMessage(
      Object.assign(
        {
          id,
        },
        msg
      ),
      transfers
    );
  });
}

function generateUUID() {
  return new Array(4)
    .fill(0)
    .map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16))
    .join('-');
}

// src/util.ts
function formatFileSystemTree(tree) {
  const newTree = {
    d: {},
  };
  for (const name of Object.keys(tree)) {
    const entry = tree[name];
    if ('file' in entry) {
      const contents = entry.file.contents;
      const stringContents =
        typeof contents === 'string' ? contents : binaryString(contents);
      const binary =
        typeof contents === 'string'
          ? {}
          : {
              b: true,
            };
      newTree.d[name] = {
        f: {
          c: stringContents,
          ...binary,
        },
      };
      continue;
    }
    const newEntry = formatFileSystemTree(entry.directory);
    newTree.d[name] = newEntry;
  }
  return newTree;
}

function binaryString(bytes) {
  let result = '';
  for (const byte of bytes) {
    result += String.fromCharCode(byte);
  }
  return result;
}

// src/index.ts
var DEFAULT_IFRAME_SOURCE = 'https://stackblitz.com/headless';
var bootPromise = null;
var booted = false;
var destroyed = false;
var decoder = new TextDecoder();
var encoder = new TextEncoder();
var WebContainer = class {
  constructor(_endpoint, fs, _iframe) {
    this._endpoint = _endpoint;
    this._iframe = _iframe;
    this.fs = new FileSystemAPIClient(fs);
  }
  fs;
  async spawn(command, optionsOrArgs, options) {
    let args = [];
    if (Array.isArray(optionsOrArgs)) {
      args = optionsOrArgs;
    } else {
      options = optionsOrArgs;
    }
    let stream = new ReadableStream();
    let output = void 0;
    if (options?.output !== false) {
      stream = new ReadableStream({
        start(controller) {
          output = (item) => controller.enqueue(item);
        },
      });
    }
    const wrapped = proxyListener(optionalBinaryListener(output));
    const process = await this._endpoint.run(
      {
        command,
        args,
        env: options?.env,
        terminal: options?.terminal,
      },
      void 0,
      void 0,
      wrapped
    );
    return new WebContainerProcessImpl(process, stream);
  }
  on(event, listener) {
    let tornDown = false;
    let unsubscribe = () => {};
    const wrapped = (...args) => {
      if (tornDown) {
        return;
      }
      listener(...args);
    };
    this._endpoint.on(event, proxy(wrapped)).then((_unsubscribe) => {
      unsubscribe = _unsubscribe;
      if (tornDown) {
        unsubscribe();
      }
    });
    return () => {
      tornDown = true;
      unsubscribe();
    };
  }
  mount(tree, options) {
    const payload = encoder.encode(JSON.stringify(formatFileSystemTree(tree)));
    return this._endpoint.loadFiles(transfer(payload, [payload.buffer]), {
      mountPoints: options?.mountPoint,
    });
  }
  teardown() {
    if (destroyed) {
      throw new Error('WebContainer already torn down');
    }
    destroyed = true;
    this.fs._teardown();
    this._endpoint.teardown();
    this._endpoint[releaseProxy]();
    this._iframe.remove();
  }
  static async boot() {
    while (bootPromise) {
      await bootPromise;
    }
    if (booted) {
      throw new Error('WebContainer already booted');
    }
    const instancePromise = unsynchronizedBoot();
    bootPromise = instancePromise.catch(() => {});
    try {
      const instance = await instancePromise;
      booted = true;
      return instance;
    } finally {
      bootPromise = null;
    }
  }
};
var DIR_ENTRY_TYPE_FILE = 1;
var DIR_ENTRY_TYPE_DIR = 2;
var DirEntImpl = class {
  constructor(name, _type) {
    this.name = name;
    this._type = _type;
  }
  isFile() {
    return this._type === DIR_ENTRY_TYPE_FILE;
  }
  isDirectory() {
    return this._type === DIR_ENTRY_TYPE_DIR;
  }
};
var WebContainerProcessImpl = class {
  constructor(_process, output) {
    this._process = _process;
    this.output = output;
    this.input = new WritableStream({
      write: (data) => {
        this._process.write(data).catch(() => {});
      },
    });
  }
  input;
  get exit() {
    return this._process.onExit;
  }
  kill() {
    this._process.kill();
  }
  resize(dimensions) {
    this._process.resize(dimensions);
  }
};
var FileSystemAPIClient = class {
  _fs;
  constructor(fs) {
    this._fs = fs;
  }
  rm(...args) {
    return this._fs.rm(...args);
  }
  async readFile(path, encoding) {
    return await this._fs.readFile(path, encoding);
  }
  async writeFile(path, data, options) {
    if (data instanceof Uint8Array) {
      const buffer = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      );
      data = transfer(new Uint8Array(buffer), [buffer]);
    }
    await this._fs.writeFile(path, data, options);
  }
  async readdir(path, options) {
    const result = await this._fs.readdir(path, options);
    if (isStringArray(result)) {
      return result;
    }
    if (isTypedArrayCollection(result)) {
      return result;
    }
    const entries = result.map(
      (entry) => new DirEntImpl(entry.name, entry['Symbol(type)'])
    );
    return entries;
  }
  async mkdir(path, options) {
    return await this._fs.mkdir(path, options);
  }
  _teardown() {
    this._fs[releaseProxy]();
  }
};
async function unsynchronizedBoot() {
  const { iframe, endpointPromise } = endpointFactory();
  const constructorEndpoint = await endpointPromise;
  const endpoint = await constructorEndpoint.build({
    host: window.location.host,
    version: '1.0.0',
  });
  const fs = await endpoint.fs();
  constructorEndpoint[releaseProxy]();
  return new WebContainer(endpoint, fs, iframe);
}

function optionalBinaryListener(listener) {
  if (listener == null) {
    return void 0;
  }
  return (data) => {
    if (data instanceof Uint8Array) {
      listener(decoder.decode(data));
    }
  };
}

function proxyListener(listener) {
  if (listener == null) {
    return void 0;
  }
  return proxy(listener);
}

function endpointFactory() {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.setAttribute('allow', 'cross-origin-isolated');
  const url = getIframeUrl();
  iframe.src = getIframeUrl().toString();
  const { origin } = url;
  const promise = new Promise((resolve) => {
    const onMessage = (event) => {
      if (event.origin !== origin) {
        return;
      }
      const { data } = event;
      if (data.type === 'init') {
        resolve(wrap(event.ports[0]));
        return;
      }
      if (data.type === 'warning') {
        console[data.level].call(console, data.message);
        return;
      }
    };
    window.addEventListener('message', onMessage);
  });
  document.body.insertBefore(iframe, null);
  return {
    iframe,
    endpointPromise: promise,
  };
}

function isStringArray(list) {
  return typeof list[0] === 'string';
}

function isTypedArrayCollection(list) {
  return list[0] instanceof Uint8Array;
}

function getIframeUrl() {
  return new URL(window.WEBCONTAINER_API_IFRAME_URL ?? DEFAULT_IFRAME_SOURCE);
}

function makeid(length) {
  var result = '';
  var characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
// WEBCONTAINER CODE ENDS HERE
(async () => {
  function loop(a, f) {
    return new Promise((resolve, reject) => {
      var i = 0;
      let next = () => {
        if (a[i]) {
          f(a[i], i++, next);
        } else {
          resolve(true);
        }
      };
      f(a[i], i++, next);
    });
  }
  const toBeCreated = [];
  let allf = document.querySelectorAll('file');
  Array.from(allf).forEach((x, _) => {
    x.style.display = 'none';
    let name = x.getAttribute('name');
    toBeCreated.push([name, x.innerHTML]);
  });
  const webcontainerInstance = await WebContainer.boot();
  await webcontainerInstance.fs.writeFile(
    'package.json',
    `{
  "name": "wenodeseven7four4replco-si0h"
}`
  );
  let fs = webcontainerInstance.fs;
  if (toBeCreated.length !== 0) {
    await loop(toBeCreated, async (x, _, next) => {
      await fs.writeFile(x[0], x[1]);
      next();
    });
  }
  let mtags = Array.from(document.querySelectorAll('modules'));
  if (mtags.length !== 0) {
    await loop(mtags, async (x, _, next) => {
      let fr = await fetch(x.getAttribute('src'));
      fr = await fr.arrayBuffer();
      fr = await decompress(fr);
      fr = JSON.parse(fr);
      console.log(fr);
      await webcontainerInstance.mount(fr);
      next();
    });
  }
  await loop(
    Array.from(document.querySelectorAll('script[type=wenode]')),
    async (x, _, next) => {
      let spawn = async function () {
        let args = Array.from(arguments);
        let process = await webcontainerInstance.spawn(...args);
        process.output.pipeTo(
          new WritableStream({
            write(data) {
              if (!x.onoutput) {
                console.log(data);
              } else {
                x.onoutput(data);
              }
            },
          })
        );
        return process;
      };
      let pkgs = x.getAttribute('packages');
      let ESM = x.hasAttribute('esm') ? '.mjs' : '.js';
      let filename = makeid(8) + ESM;
      if (pkgs) {
        const installProcess = await spawn('npm', [
          'install',
          ...pkgs.split(' '),
        ]);
        const installExitCode = await installProcess.exit;

        if (installExitCode !== 0) {
          if (x.oninstallfail) x.oninstallfail;
          if (x.hasAttribute('oninstallfail')) {
            eval(x.getAttribute('oninstallfail'));
          } else {
            throw new Error('Unable to install');
          }
        } else {
          if (x.oninstall) x.oninstall();
          if (x.hasAttribute('oninstall')) eval(x.getAttribute('oninstall'));
        }
      }
      let client = x.getAttribute('client');

      if (!x.hasAttribute('no-autostart')) {
        await fs.writeFile(filename, x.innerText);
        await spawn('node', [filename]);
        webcontainerInstance.on('server-ready', (port, url) => {
          if (client) {
            let iframeEl = document.querySelector(client);
            iframeEl.src = url;
          }
          if (x.onserver) x.onserver(url);
          if (x.hasAttribute('onserver')) eval(x.getAttribute('onserver'));
        });
      } else {
        x.start = async () => {
          await fs.writeFile(filename, x.innerText);
          await spawn('node', [filename]);
          webcontainerInstance.on('server-ready', (port, url) => {
            if (client) {
              let iframeEl = document.querySelector(client);
              iframeEl.src = url;
            }
            if (x.onserver) x.onserver(url);
            if (x.hasAttribute('onserver')) eval(x.getAttribute('onserver'));
          });
        };
      }
      next();
    }
  );
})();

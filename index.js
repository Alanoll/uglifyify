var convert = require('convert-source-map')
  , through = require('through')
  , path = require('path')
  , ujs = require('uglify-js')
  , extend = require('extend')

module.exports = uglifyify

function uglifyify(file, opts) {
  opts = opts || {}

  var buffer = ''
  var exts = []
    .concat(opts.exts || [])
    .concat(opts.x || [])

  if (
    /\.json$/.test(file) ||
    exts.length &&
    exts.indexOf(path.extname(file)) === -1
  ) {
    return through()
  }

  return through(function write(chunk) {
    buffer += chunk
  }, capture(function ready() {
    opts = extend({}, {
      fromString: true
      , compress: true
      , mangle: true
    }, opts)

    // Check if incoming source code already has source map comment.
    // If so, send it in to ujs.minify as the inSourceMap parameter
    var sourceMaps = buffer.match(
      /\/\/[#@] ?sourceMappingURL=data:application\/json;base64,([a-zA-Z0-9+\/]+)={0,2}$/
    )

    opts.outSourceMap = 'out.js.map'
    opts.inSourceMap = sourceMaps && convert.fromJSON(
      new Buffer(sourceMaps[1], 'base64').toString()
    ).sourcemap

    var min = ujs.minify(buffer, opts)
    this.queue(min.code)

    if (min.map) {
      var map = convert.fromJSON(min.map)
      map.setProperty('sources', [file])
      map.setProperty('sourcesContent', sourceMaps
        ? opts.inSourceMap.sourcesContent
        : [buffer]
      )

      this.queue('\n')
      this.queue(map.toComment())
    }

    this.queue(null)
  }))

  function capture(fn) {
    return function() {
      try {
        fn.apply(this, arguments)
      } catch(err) {
        return this.emit('error', err)
      }
    }
  }
}

var common = require('./common.js');
var binding = require('.');

var assertEqual = function(key, a, b) {
  try {
    if (a.length !== b.length) throw new Error(key + ' has different length');
    var length = a.length;
    while (length--) {
      if (a[length] !== b[length]) throw new Error(key + ' is different');
    }
  } catch (error) {
    console.log(key + ': a: ' + a.toString('hex'));
    console.log(key + ': b: ' + b.toString('hex'));
    throw error;
  }
};

var wrap = function(columns) {
  return columns[0] + ' ' + columns.slice(1).join('\r\n       ') + '\r\n';
};

var Algorithms = {};

Algorithms.Cipher = [
  { name: 'AES-128-CBC', keySize: 16, ivSize: 16 },
  { name: 'AES-192-CBC', keySize: 24, ivSize: 16 },
  { name: 'AES-256-CBC', keySize: 32, ivSize: 16 },
  { name: 'AES-128-CTR', keySize: 16, ivSize: 16 },
  { name: 'AES-192-CTR', keySize: 24, ivSize: 16 },
  { name: 'AES-256-CTR', keySize: 32, ivSize: 16 }
];

Algorithms.Hash = Algorithms.HMAC = [
  { name: 'MD5', targetSize: 16 },
  { name: 'SHA1', targetSize: 20 },
  { name: 'SHA256', targetSize: 32 },
  { name: 'SHA512', targetSize: 64 }
];

var Compare = {};

Compare.Cipher = function(a, b) {
  assertEqual('key', a.key, b.key);
  assertEqual('iv', a.iv, b.iv);
  assertEqual('source', a.source, b.source);
  assertEqual('target', a.target, b.target);
};

Compare.Hash = function(a, b) {
  assertEqual('source', a.source, b.source);
  assertEqual('target', a.target, b.target);
};

Compare.HMAC = function(a, b) {
  assertEqual('key', a.key, b.key);
  assertEqual('source', a.source, b.source);
  assertEqual('target', a.target, b.target);
};

var Describe = {};

Describe.Cipher = function(index, vector) {
  console.log(wrap([
    common.pad(index + 1, 6, '0'),
    vector.algorithm,
    // We do not show encrypt because we encrypt and decrypt per test.
    'key=' + vector.key.length,
    'keyOffset=' + vector.keyOffset,
    'keySize=' + vector.keySize,
    'iv=' + vector.iv.length,
    'ivOffset=' + vector.ivOffset,
    'ivSize=' + vector.ivSize,
    'source=' + vector.source.length,
    'sourceOffset=' + vector.sourceOffset,
    'sourceSize=' + vector.sourceSize,
    'target=' + vector.target.length,
    'targetOffset=' + vector.targetOffset
  ]));
};

Describe.Hash = function(index, vector) {
  console.log(wrap([
    common.pad(index + 1, 6, '0'),
    'HASH-' + vector.algorithm,
    'source=' + vector.source.length,
    'sourceOffset=' + vector.sourceOffset,
    'sourceSize=' + vector.sourceSize,
    'target=' + vector.target.length,
    'targetOffset=' + vector.targetOffset
  ]));
};

Describe.HMAC = function(index, vector) {
  console.log(wrap([
    common.pad(index + 1, 6, '0'),
    'HMAC-' + vector.algorithm,
    'key=' + vector.key.length,
    'keyOffset=' + vector.keyOffset,
    'keySize=' + vector.keySize,
    'source=' + vector.source.length,
    'sourceOffset=' + vector.sourceOffset,
    'sourceSize=' + vector.sourceSize,
    'target=' + vector.target.length,
    'targetOffset=' + vector.targetOffset
  ]));
};

var Execute = {};

Execute.Cipher = function(binding, vector, end) {
  binding.cipher(
    vector.algorithm,
    1,
    vector.key,
    vector.keyOffset,
    vector.keySize,
    vector.iv,
    vector.ivOffset,
    vector.ivSize,
    vector.source,
    vector.sourceOffset,
    vector.sourceSize,
    vector.target,
    vector.targetOffset,
    function(error, targetSize) {
      if (error) return end(error);
      var temp = new Buffer(vector.sourceSize + 128);
      binding.cipher(
        vector.algorithm,
        0,
        vector.key,
        vector.keyOffset,
        vector.keySize,
        vector.iv,
        vector.ivOffset,
        vector.ivSize,
        vector.target,
        vector.targetOffset,
        targetSize,
        temp,
        0,
        function(error, sourceSize) {
          if (error) return end(error);
          temp.copy(vector.source, vector.sourceOffset, 0, sourceSize);
          end();
        }
      );
    }
  );
};

Execute.Hash = function(binding, vector, end) {
  binding.hash(
    vector.algorithm,
    vector.source,
    vector.sourceOffset,
    vector.sourceSize,
    vector.target,
    vector.targetOffset,
    end
  );
};

Execute.HMAC = function(binding, vector, end) {
  binding.hmac(
    vector.algorithm,
    vector.key,
    vector.keyOffset,
    vector.keySize,
    vector.source,
    vector.sourceOffset,
    vector.sourceSize,
    vector.target,
    vector.targetOffset,
    end
  );
};

console.log('\r\n  SEED=' + common.seed + '\r\n');

var queue = new common.QueueStream(1);
queue.onData = function(test, end) {
  var a = new common.Vector[test.type](Algorithms[test.type], undefined);
  var b = new common.Vector[test.type](Algorithms[test.type], a);
  Describe[test.type](test.index, a);
  Execute[test.type](binding, a,
    function(error) {
      if (error) return end(error);
      Execute[test.type](common.independent, b,
        function(error) {
          if (error) return end(error);
          Compare[test.type](a, b);
          end();
        }
      );
    }
  );
};
queue.onEnd = function(error) {
  if (error) throw error;
  console.log('PASSED ALL TESTS\r\n');
};
var tests = [];
var index = 0;
var length = 10000;
while (length--) tests.push({ type: 'Cipher', index: index++ });
var length = 10000;
while (length--) tests.push({ type: 'Hash', index: index++ });
var length = 10000;
while (length--) tests.push({ type: 'HMAC', index: index++ });
queue.push(tests);
queue.end();
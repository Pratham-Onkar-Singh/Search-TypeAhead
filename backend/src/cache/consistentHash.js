const crypto = require('crypto');

class ConsistentHashRing {
  constructor(nodes = [], virtualNodeCount = 150) {
    this.ring = new Map();
    this.sortedKeys = [];
    this.virtualNodeCount = virtualNodeCount;
    this.nodes = new Set();

    for (const node of nodes) {
      this.addNode(node);
    }
  }

  _hash(key) {
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }

  addNode(node) {
    this.nodes.add(node);
    for (let i = 0; i < this.virtualNodeCount; i++) {
      const virtualKey = `${node}-vn-${i}`;
      const hash = this._hash(virtualKey);
      this.ring.set(hash, node);
    }
    this._rebuildSortedKeys();
  }

  removeNode(node) {
    this.nodes.delete(node);
    for (let i = 0; i < this.virtualNodeCount; i++) {
      const virtualKey = `${node}-vn-${i}`;
      const hash = this._hash(virtualKey);
      this.ring.delete(hash);
    }
    this._rebuildSortedKeys();
  }

  _rebuildSortedKeys() {
    this.sortedKeys = Array.from(this.ring.keys()).sort((a, b) => a - b);
  }

  getNode(key) {
    if (this.sortedKeys.length === 0) return null;

    const hash = this._hash(key);

    // Binary search for the first key >= hash (clockwise walk)
    let lo = 0, hi = this.sortedKeys.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.sortedKeys[mid] < hash) lo = mid + 1;
      else hi = mid;
    }

    // Wrap around to the first node if we passed the end
    const idx = lo % this.sortedKeys.length;
    return {
      node: this.ring.get(this.sortedKeys[idx]),
      hashValue: hash.toString(16),
    };
  }

  getNodeList() {
    return Array.from(this.nodes);
  }
}

module.exports = ConsistentHashRing;

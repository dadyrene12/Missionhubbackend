const NodeCache = require('node-cache');

const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 120, // Check for expired keys every 2 min
  useClones: false // Faster, but be careful with mutations
});

// Cache stats with longer TTL
const statsCache = new NodeCache({ 
  stdTTL: 600, // 10 minutes for stats
  checkperiod: 120 
});

module.exports = {
  cache,
  statsCache,
  get: (key) => cache.get(key),
  set: (key, val, ttl) => cache.set(key, val, ttl),
  del: (key) => cache.del(key),
  statsGet: (key) => statsCache.get(key),
  statsSet: (key, val, ttl) => statsCache.set(key, val, ttl),
  clearStats: () => statsCache.flushAll()
};


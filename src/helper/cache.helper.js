const redis = require('../config/redis')

const PRODUCT_CACHE_PREFIX = 'products:home'
const PRODUCT_CACHE_TTL = 60 * 10 // 10 minutes
const NO_EXPIRE = null // kept until clearProductCache() runs

// Build a stable key from the request query so the same params hit the same cache entry
const buildProductCacheKey = (type, query) => {
    const params = Object.keys(query)
        .sort()
        .map((key) => `${key}=${query[key]}`)
        .join('&')
    return `${PRODUCT_CACHE_PREFIX}:${type}:${params}`
}

const getCache = async (key) => {
    if (!redis.isReady) return null
    try {
        const data = await redis.get(key)
        return data ? JSON.parse(data) : null
    } catch (error) {
        console.log('🚀 ~ getCache ~ error:', error)
        return null
    }
}

const setCache = async (key, value, ttl = PRODUCT_CACHE_TTL) => {
    if (!redis.isReady) return
    try {
        if (ttl === NO_EXPIRE) {
            await redis.set(key, JSON.stringify(value))
        } else {
            await redis.setEx(key, ttl, JSON.stringify(value))
        }
    } catch (error) {
        console.log('🚀 ~ setCache ~ error:', error)
    }
}

// Remove every cached product list, called whenever a product changes
const clearProductCache = async () => {
    if (!redis.isReady) return
    try {
        const keys = []
        for await (const key of redis.scanIterator({
            MATCH: `${PRODUCT_CACHE_PREFIX}:*`,
            COUNT: 100,
        })) {
            keys.push(key)
        }
        if (keys.length) await redis.del(keys)
    } catch (error) {
        console.log('🚀 ~ clearProductCache ~ error:', error)
    }
}

module.exports = {
    NO_EXPIRE,
    buildProductCacheKey,
    getCache,
    setCache,
    clearProductCache,
}

const redis = require('redis')
const dotenv = require('dotenv')
dotenv.config()

const REDIS_CONFIG = {
    url: process.env.KV_URL,
}
const client = redis.createClient(REDIS_CONFIG)

const handleEventRedisStatus = (status) => {
    client.on(status, () => {
        console.log(`> ${status} to Redis cache`)
    })
}

handleEventRedisStatus('connect')
handleEventRedisStatus('error')

client.on('ready', () => {
    console.log('🚀 ~~~ connected to Redis::::Ecommerce-Pet ')
})

module.exports = client

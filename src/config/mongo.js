const mongoose = require('mongoose')
const { appConfig } = require('./app')
async function connect() {
    try {
        await mongoose.connect(process.env.BASE_URL_DB || appConfig.db.url, {
            useNewUrlParser: true,
        })

        console.log('🚀 ~~~ connected to MongoDB::::Ecommerce-Pet ')
    } catch (error) {
        console.log('🚀 ~ file: mongo.js ~ connect ~ error:', error)
        console.log('Connect Failed MongoDB!!')
    }
}
module.exports = { connect }

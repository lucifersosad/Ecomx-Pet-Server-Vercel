require('dotenv').config()
const moment = require('moment')
const Order = require('../models/order.model')
const User = require('../models/user.model')
const Product = require('../models/product.model')
const Cart = require('../models/cart.model')
const {
    HTTP_STATUS,
    STATUS_ORDER,
    PAYMENT_METHOD,
} = require('../utils/constant')
const redis = require('../config/redis')

//[POST] CREATE PAYMENT
const createPayment = async (req, res, amount, bankCode, language) => {
    process.env.TZ = 'Asia/Ho_Chi_Minh'

    let date = new Date()
    let createDate = moment(date).format('YYYYMMDDHHmmss')

    let ipAddr =
        req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress

    // let config = require('config')
    let tmnCode = `${process.env.VNP_TMNCODE}`
    let secretKey = `${process.env.VNP_HASH_SECRET}`
    let vnpUrl = `${process.env.VNP_URL}`
    let returnUrl = `${process.env.VNP_RETURN_URL}`
    let order_id = req.params.order_id
    // let amount = req.body.amount
    // let bankCode = req.body.bankCode

    let locale = language
    if (locale === null || locale === '') {
        locale = 'vn'
    }
    let currCode = 'VND'
    let vnp_Params = {}
    vnp_Params['vnp_Version'] = '2.1.0'
    vnp_Params['vnp_Command'] = 'pay'
    vnp_Params['vnp_TmnCode'] = tmnCode
    vnp_Params['vnp_Locale'] = locale
    vnp_Params['vnp_CurrCode'] = currCode
    vnp_Params['vnp_TxnRef'] = order_id
    // moment(date).format('DDHHmmss')
    vnp_Params['vnp_OrderInfo'] = 'Thanh toan cho ma GD:' + order_id
    vnp_Params['vnp_OrderType'] = 'other'
    vnp_Params['vnp_Amount'] = amount * 100
    vnp_Params['vnp_ReturnUrl'] = returnUrl
    vnp_Params['vnp_IpAddr'] = ipAddr
    vnp_Params['vnp_CreateDate'] = createDate

    if (bankCode !== null && bankCode !== '') {
        vnp_Params['vnp_BankCode'] = bankCode
    }

    vnp_Params = sortObject(vnp_Params)

    let querystring = require('qs')
    let signData = querystring.stringify(vnp_Params, { encode: false })
    let crypto = require('crypto')
    let hmac = crypto.createHmac('sha512', secretKey)
    let signed = hmac.update(new Buffer(signData, 'utf-8')).digest('hex')
    vnp_Params['vnp_SecureHash'] = signed
    vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false })

    return vnpUrl
}
//[GET] RETURN PAYMENT STATUS
// clear cart => change status order = express -> send order warehouse => select shipper to shipping
const getPaymentSuccess = async (req, res) => {
    let vnp_Params = req.query
    let secureHash = vnp_Params['vnp_SecureHash']
    delete vnp_Params['vnp_SecureHash']
    delete vnp_Params['vnp_SecureHashType']
    vnp_Params = sortObject(vnp_Params)
    let tmnCode = `${process.env.VNP_TMNCODE}`
    let secretKey = `${process.env.VNP_HASH_SECRET}`
    let querystring = require('qs')
    let signData = querystring.stringify(vnp_Params, { encode: false })
    let crypto = require('crypto')
    let hmac = crypto.createHmac('sha512', secretKey)
    let signed = hmac.update(new Buffer(signData, 'utf-8')).digest('hex')
    const order_id = vnp_Params['vnp_TxnRef']

    if (secureHash !== signed) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
            success: false,
            message: 'Payment failed',
            code: '97',
        })
    }

    try {
        await redis.del(order_id)

        // 00 = paid, anything else = cancelled/failed -> let user retry
        if (vnp_Params['vnp_ResponseCode'] !== '00') {
            await Order.findByIdAndUpdate(order_id, {
                $set: { status: STATUS_ORDER.UNPAID },
            })
            return res.redirect(
                `${process.env.CLIENT_URL}/checkout?order_id=${order_id}`
            )
        }

        const paidOrder = await Order.findOneAndUpdate(
            {
                _id: order_id,
            },
            {
                $set: {
                    status: STATUS_ORDER.PAID,
                },
                $pull: {
                    paymentMethod: PAYMENT_METHOD.ONLINE,
                },
            },
            {
                new: true,
            }
        )
        if (paidOrder) {
            await Cart.updateOne(
                { _id: paidOrder.user_id },
                { $set: { cart_details: [], dateUpdate: Date.now() } }
            )
        }

        return res.redirect(
            `${process.env.CLIENT_URL}/payment-success?code=${order_id}`
        )
    } catch (error) {
        console.log('🚀 ~ getPaymentSuccess ~ error:', error)
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Payment failed',
            code: '99',
        })
    }
}
function sortObject(obj) {
    let sorted = {}
    let str = []
    let key
    for (key in obj) {
        if (obj.hasOwnProperty(key)) {
            str.push(encodeURIComponent(key))
        }
    }
    str.sort()
    for (key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(
            /%20/g,
            '+'
        )
    }
    return sorted
}
module.exports = {
    createPayment,
    getPaymentSuccess,
}

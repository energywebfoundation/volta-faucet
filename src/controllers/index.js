const EthereumTx = require('ethereumjs-tx')
const { generateErrorResponse } = require('../helpers/generate-response')
const { validateCaptcha } = require('../helpers/captcha-helper')
const { debug } = require('../helpers/debug')

module.exports = function (app) {
    const config = app.config
    const web3 = app.web3

    const messages = {
        INVALID_CAPTCHA: 'Invalid captcha',
        INVALID_ADDRESS: 'Invalid address',
        TX_HAS_BEEN_MINED_WITH_FALSE_STATUS: 'Transaction has been mined, but status is false',
        TX_HAS_BEEN_MINED: 'Tx has been mined',
    }

    app.post('/', async function (request, response) {
        const isDebug = app.config.debug
        debug(isDebug, "REQUEST:")
        debug(isDebug, request.body)

        const recaptureResponse = request.body["g-recaptcha-response"]
        if (!recaptureResponse) {
            const error = {
                message: messages.INVALID_CAPTCHA,
            }
            return generateErrorResponse(response, error)
        }

        let captchaResponse
        try {
            captchaResponse = await validateCaptcha(app, recaptureResponse)
        } catch (e) {
            return generateErrorResponse(response, e)
        }

        const receiver = request.body.receiver
        if (await validateCaptchaResponse(captchaResponse, receiver, response)) {
            await sendTokensToRecipient(web3, receiver, response, isDebug)
        }
    });

    app.get('/health', async function (request, response) {
        let balanceInWei
        let balanceInEth
        const address = config.Ethereum[config.environment].account
        try {
            balanceInWei = await web3.eth.getBalance(address)
            balanceInEth = await web3.utils.fromWei(balanceInWei, "ether")
        } catch (error) {
            return generateErrorResponse(response, error)
        }

        const resp = {
            address,
            balanceInWei: balanceInWei,
            balanceInEth: Math.round(balanceInEth)
        }
        response.send(resp)
    });

    async function validateCaptchaResponse(captchaResponse, receiver, response) {
        if (!captchaResponse || !captchaResponse.success) {
            generateErrorResponse(response, { message: messages.INVALID_CAPTCHA })
            return false
        }

        return true
    }

    const GAS_PRICE_BUMP_PERCENT = 20
    const MAX_RETRIES = 3

    async function sendTokensToRecipient(web3, receiver, response, isDebug, retryCount = 0) {
        let senderPrivateKey = config.Ethereum[config.environment].privateKey
        const privateKeyHex = Buffer.from(senderPrivateKey, 'hex')
        if (!web3.utils.isAddress(receiver)) {
            return generateErrorResponse(response, { message: messages.INVALID_ADDRESS })
        }

        let gasPriceWei
        if (config.Ethereum.gasPriceGwei) {
            gasPriceWei = Math.floor(parseFloat(config.Ethereum.gasPriceGwei) * 1e9).toString()
        } else {
            gasPriceWei = config.Ethereum.gasPrice
        }
        if (retryCount > 0) {
            const bumpMultiplier = 100 + (GAS_PRICE_BUMP_PERCENT * (retryCount))
            gasPriceWei = new web3.utils.BN(gasPriceWei).mul(bumpMultiplier).div(100)
        }
        const gasPriceHex = web3.utils.toHex(gasPriceWei)
        const gasLimitHex = web3.utils.toHex(config.Ethereum.gasLimit)
        const nonce = await web3.eth.getTransactionCount(config.Ethereum[config.environment].account, 'pending')
        const nonceHex = web3.utils.toHex(nonce)
        const BN = web3.utils.BN
        const ethToSend = web3.utils.toWei(new BN(config.Ethereum.milliEtherToTransfer), "milliether")
        const rawTx = {
            nonce: nonceHex,
            gasPrice: gasPriceHex,
            gasLimit: gasLimitHex,
            to: receiver,
            value: ethToSend
        }

        const tx = new EthereumTx(rawTx)
        tx.sign(privateKeyHex)

        const serializedTx = tx.serialize()

        const sendTx = () => new Promise((resolve, reject) => {
            let txHash
            web3.eth.sendSignedTransaction("0x" + serializedTx.toString('hex'))
                .on('transactionHash', (_txHash) => {
                    txHash = _txHash
                })
                .on('receipt', (receipt) => {
                    debug(isDebug, receipt)
                    if (receipt.status == '0x1') {
                        resolve(sendRawTransactionResponse(txHash, response))
                    } else {
                        reject(new Error(messages.TX_HAS_BEEN_MINED_WITH_FALSE_STATUS))
                    }
                })
                .on('error', (error) => {
                    reject(error)
                })
        })

        try {
            await sendTx()
        } catch (error) {
            const errMsg = (error && error.message) ? error.message : String(error)
            const isGasNonceError = /gas price.*too low|same nonce|nonce.*queue/i.test(errMsg)
            if (isGasNonceError && retryCount < MAX_RETRIES) {
                debug(isDebug, `Gas/nonce error, retrying (${retryCount + 1}/${MAX_RETRIES}) with higher gas price`)
                return sendTokensToRecipient(web3, receiver, response, isDebug, retryCount + 1)
            }
            return generateErrorResponse(response, error)
        }
    }

    function sendRawTransactionResponse(txHash, response) {
        const successResponse = {
            code: 200,
            title: 'Success',
            message: messages.TX_HAS_BEEN_MINED,
            txHash: txHash,
            explorerTxUrl: config.explorerTxUrl.replace(/\/$/, "")
        }

        response.send({
            success: successResponse
        })
    }
}

## EWF Volta test network faucet

### Building from source

1. Clone repository
  ```
  git clone https://github.com/energywebfoundation/volta-faucet.git
  ```
2. Copy `config.json.example` to `config.json`
  ```
  cp config.json.example config.json
  ```
2. Update config.json `./config.json` (see config.json with placeholders below)
3. Update `./public/index.html`: Find `<div class="g-recaptcha" data-sitekey="type your reCaptcha plugin secret here"></div>` line and type your reCaptcha plugin secret in `data-sitekey` attribute. For more info, [see](https://developers.google.com/recaptcha/docs/verify?hl=ru)
4. Install dependencies `npm install` from the project's root
5. Run faucet with `npm start`. EWF Volta faucet will be launched at `http://localhost:5000`

### Server config.json (`./config.json`) with placeholders
```
{
  "environment": "switcher between configurations: 'prod' or 'dev'",
  "debug": "switch on/off server logs: true or false",
  "Captcha": {
    "secret": "reCaptcha plugin secret"
  },
  "explorerTxUrl": "URL of the blockchain explorer to use for looking up the tx hash, e.g. http://explorer.energyweb.org/tx",
  "Ethereum": {
    "etherToTransfer": "The number of milliEther to be sent from the faucet. For example, 500",
    "gasLimit": "Transaction gas limit, e.g. 2452000",
    "gasPriceGwei": "Gas price in Gwei, e.g. 1.001 (use this for Volta; gasPrice in wei also supported)",
    "prod": {
      "rpc": "JSON RPC endpoint. For example, https://core.poa.network",
      "account": "The address from which the funds will be drained",
      "privateKey": "Private key of the account"
    },
    "dev": {
      ...
    }
  }
}

// noinspection SpellCheckingInspection

const fs = require('fs')
const got = require('got')
const Form = require('form-data')
const readline = require('readline')
const rl = readline.createInterface(process.stdin, process.stdout)
console.clear()

rl.question('Token? ', token => {
  if (token === '') {
    console.log('Token empty!')
    process.exit(1)
  }
  rl.question('Channel ID? ', cid => {
    if (cid === '') {
      console.log('Channel ID empty!')
      process.exit(1)
    }
    rl.question('Caption? ', async caption => {
      const files = fs.readdirSync('./Input/')
      let count = 0
      let uploads = []
      for (let i = 0; i < files.length; i++) {
        if (
          fs.statSync(`./Input/${files[i]}`).isDirectory() ||
          files[i] === '.gitkeep'
        ) {
          continue
        }
        count++
      }
      if (count === 0) {
        console.log("0 file found. Please put file in 'Input' folder.")
        process.exit(1)
      }
      console.log(`Uploading ${count} ${count > 1 ? 'files' : 'file'}`)
      for (const file of files) {
        if (
          fs.statSync(`./Input/${file}`).isDirectory() ||
          file === '.gitkeep'
        ) {
          continue
        }
        uploads.push(file)
      }
      for (const upload of uploads) {
        const message = caption
          .replace('{{index}}', `${uploads.indexOf(upload) + 1}`)
          .replace('{{length}}', `${uploads.length}`)
        const snowflake = () => (+new Date() - 1420070400000) * (2 ** 22)
        const sleep = (time) => new Promise(resolve => setTimeout(resolve, time))
        const start = new Date()
        const data = new Form()
        data.append('file', fs.createReadStream(`./Input/${upload}`))
        data.append('payload_json', `{"content":"${message}","tts":false,"nonce":"${snowflake()}"}`)
        const res = await got.post(
          `https://discord.com/api/v9/channels/${cid}/messages`,
          {
            body: data,
            responseType: 'json',
            resolveBodyOnly: true,
            throwHttpErrors: false,
            headers: {
              authorization: token,
              'user-agent':
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) discord/0.0.127 Chrome/91.0.4472.164 Electron/13.2.2 Safari/537.36'
            }
          }
        )
        if (res.code === 40005) {
          console.log(`[${uploads.indexOf(upload) + 1}/${uploads.length}] File too large... ${upload}`)
          if (fs.existsSync('./cyberdrop.json')) {
            console.log('Uploading large file to cyberdrop.me...')
            const ctoken = require('./cyberdrop.json').token
            const cform = new Form()
            cform.append('files[]', fs.createReadStream(`./Input/${upload}`))
            cform.append('filename', upload)
            const cme = await got.post('https://edgechunked.cyberdrop.me/api/upload',
              {
                body: cform,
                responseType: 'json',
                resolveBodyOnly: true,
                throwHttpErrors: false,
                headers: {
                  token: ctoken,
                  'user-agent':
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) discord/0.0.127 Chrome/91.0.4472.164 Electron/13.2.2 Safari/537.36'
                }
              }
            )
            if (cme.success) {
              const xc = await got.post(
                `https://discord.com/api/v9/channels/${cid}/messages`,
                {
                  json: {
                    content: `${message}\n${cme.files[0].url}`,
                    tts: false,
                    nonce: snowflake()
                  },
                  responseType: 'json',
                  resolveBodyOnly: true,
                  throwHttpErrors: false,
                  headers: {
                    authorization: token,
                    'user-agent':
                      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) discord/0.0.127 Chrome/91.0.4472.164 Electron/13.2.2 Safari/537.36'
                  }
                }
              )
              if (!xc.id) {
                console.log('Something wrong when uploading cyberdrop.me link')
                console.log(xc)
              }
            } else {
              console.log('Something wrong when uploading to cyberdrop.me')
              console.log(cme)
            }
          }
        } else { // noinspection JSUnresolvedVariable
          if (res.retry_after) {
            console.log(`[${uploads.indexOf(upload) + 1}/${uploads.length}] Rate limited...`)
            uploads = [upload].concat(uploads)
            // noinspection JSUnresolvedVariable
            await sleep(res.retry_after * 1000)
          } else {
            const end = new Date() - start
            console.log(`[${uploads.indexOf(upload) + 1}/${uploads.length}] OK (${end / 1000} sec.) ${upload}`)
          }
        }
      }
      process.exit(0)
    })
  })
})

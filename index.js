const fs = require('fs')
const got = require('got')
const Form = require('form-data')
const readline = require('readline')
const rl = readline.createInterface(process.stdin, process.stdout)
console.clear()
const data = {
  token: '',
  channel_id: '',
  caption: '',
  files: [],
  currentFile: ''
}

rl.question('Token? ', token => {
  if (token === '') {
    console.log('Token cannot be empty!')
    process.exit(1)
  }
  data.token = token
  rl.question('Channel ID? ', channelID => {
    if (channelID === '') {
      console.log('Channel ID cannot be empty!')
      process.exit(1)
    }
    data.channel_id = channelID
    rl.question('Caption? ', caption => {
      data.caption = caption
      load().catch(() => {})
    })
  })
})

const load = async () => {
  const folder = fs.readdirSync('./Input')
  if (folder.length === 1 && folder[0] === '.gitkeep') {
    console.log('0 files found. Put files into \'Input\' folder')
    process.exit(1)
  }
  for (const files of folder) {
    if (files === '.gitkeep' || fs.statSync(`./Input/${files}`).isDirectory()) continue
    data.files.push(files)
  }
  console.log(`Found ${data.files.length} files`)
  const start = new Date()
  for (const file of data.files) {
    console.log(`[${data.files.indexOf(file) + 1}/${data.files.length}] Uploading ${file}`)
    await uploadDiscord({ file, message: data.caption })
  }
  console.log(`Upload finished in (${(new Date() - start) / 1000} sec.)`)
  process.exit(0)
}

const uploadDiscord = async ({ file, message, cyberdrop }) => {
  const caption = message.replace('{{index}}', String(data.files?.indexOf(file) + 1)).replace('{{length}}', String(data.files.length))
  const snowflake = () => (+new Date() - 1420070400000) * (2 ** 22)
  const sleep = (time) => new Promise(resolve => setTimeout(resolve, time))
  const start = new Date()
  let uploadData
  if (cyberdrop) {
    uploadData = {
      content: `${caption}\n${cyberdrop}`,
      tts: false,
      nonce: snowflake()
    }
  } else {
    uploadData = new Form()
    uploadData.append('file', fs.createReadStream(`./Input/${file}`))
    uploadData.append('payload_json', `{"content": "${caption}","tts":false,"nonce":"${snowflake()}"}`)
  }
  const response = await got.post(`https://discord.com/api/v9/channels/${data.channel_id}/messages`, {
    body: uploadData,
    responseType: 'json',
    resolveBodyOnly: true,
    throwHttpErrors: false,
    headers: {
      authorization: data.token,
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) discord/0.0.127 Chrome/91.0.4472.164 Electron/13.2.2 Safari/537.36'
    },
    hooks: {
      init: [
        options => {
          if (cyberdrop) {
            delete options.body
            options.json = uploadData
          }
        }
      ]
    }
  })
  if (response.code === 40005) {
    console.log(`[${data.files.indexOf(file) + 1}/${data.files.length}] File too large...`)
    if (fs.existsSync('./cyberdrop.json')) {
      console.log(`[${data.files.indexOf(file) + 1}/${data.files.length}] Uploading to cyberdrop.me`)
      const { token } = require('./cyberdrop.json')
      const cyberForm = new Form()
      cyberForm.append('files[]', fs.createReadStream(`./Input/${file}`))
      cyberForm.append('filename', file)
      const cyberRes = await got.post('https://edgechunked.cyberdrop.me/api/upload', {
        body: cyberForm,
        responseType: 'json',
        resolveBodyOnly: true,
        throwHttpErrors: false,
        headers: {
          token,
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) discord/0.0.127 Chrome/91.0.4472.164 Electron/13.2.2 Safari/537.36'
        }
      })
      if (cyberRes.success) {
        await uploadDiscord({ file, message: caption, cyberdrop: cyberRes.files[0].url })
        return
      } else {
        console.log(`[${data.files.indexOf(file) + 1}/${data.files.length}] Something wrong when uploading to cyberdrop.me`)
        console.log(cyberRes)
        return
      }
    } else {
      console.log(`[${data.files.indexOf(file) + 1}/${data.files.length}] Skipping upload large file to cyberdrop.me since cannot find cyberdrop.json`)
      return
    }
  }
  // noinspection JSUnresolvedVariable
  if (response.retry_after) {
    console.log(`[${data.files.indexOf(file) + 1}/${data.files.length}] Rate limited...`)
    // noinspection JSUnresolvedVariable
    await sleep(response.retry_after)
    await uploadDiscord({ file, message: caption })
    return
  } if (!response.id) {
    console.log(`[${data.files.indexOf(file) + 1}/${data.files.length}] Failed to upload`)
    console.log(response)
  } else {
    console.log(`[${data.files.indexOf(file) + 1}/${data.files.length}] OK (${(new Date() - start) / 1000} sec.)`)
  }
}

// TODO: Colorize logs
// TODO: Catch some errors

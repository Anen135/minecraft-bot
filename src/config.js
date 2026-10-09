require('dotenv').config()

module.exports = {
    minecraft: {
        host: process.env.MC_HOST || '127.0.0.1',
        port: Number(process.env.MC_PORT) || 25565,
        username: process.env.MC_USERNAME || 'AnenBot',
        auth: process.env.MC_AUTH || 'offline'
    },

    bot: {
        prefix: process.env.BOT_PREFIX || '!',
        owner: process.env.OWNER_NAME || 'Anen'
    }
}

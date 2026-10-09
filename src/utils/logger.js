function log(scope, message) {
    console.log(
        `[${new Date().toISOString()}] [${scope}] ${message}`
    )
}

module.exports = {
    info(message) {
        log('INFO', message)
    },

    warn(message) {
        log('WARN', message)
    },

    error(message) {
        log('ERROR', message)
    }
}

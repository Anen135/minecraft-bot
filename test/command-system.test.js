import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import CommandLoader from '../src/commands/CommandLoader.js'
import CommandManager from '../src/commands/CommandManager.js'
import CommandRegistry from '../src/commands/CommandRegistry.js'

test('repository commands load and register with their existing and manual ability names', async t => {
    t.mock.method(console, 'log', () => {})
    const errors = t.mock.method(console, 'error', () => {})
    const warnings = t.mock.method(console, 'warn', () => {})
    const commands = await new CommandLoader(new URL('../src/commands/handlers/', import.meta.url)).load()
    const registry = new CommandRegistry(commands)
    assert.deepEqual(registry.names().sort(),
        ['chop', 'craft', 'environment', 'equip', 'follow', 'goto', 'help', 'inventory', 'look', 'mine', 'nearby', 'scan', 'status', 'stop'])
    assert.equal(errors.mock.callCount(), 0)
    assert.equal(warnings.mock.callCount(), 0)
})

test('loader loads default ESM commands and continues after invalid or failing files', async t => {
    const directory = await mkdtemp(join(tmpdir(), 'minecraft-bot-commands-'))
    t.after(() => rm(directory, { recursive: true, force: true }))
    t.mock.method(console, 'log', () => {})
    const warnings = t.mock.method(console, 'warn', () => {})
    const errors = t.mock.method(console, 'error', () => {})

    await writeFile(join(directory, 'package.json'), '{"type":"module"}')
    const fixtures = {
        'a-broken.js': 'throw new Error("Broken command module")',
        'b-missing-default.js': 'export const name = "missing"',
        'c-missing-name.js': 'export default { execute() {} }',
        'd-empty-name.js': 'export default { name: " ", execute() {} }',
        'e-invalid-name.js': 'export default { name: 12, execute() {} }',
        'f-invalid-execute.js': 'export default { name: "invalid", execute: true }',
        'ping.js': 'export default { name: "Ping", async execute() { return "Pong!" } }',
        'special # command.js': 'export default { name: "special", execute() {} }',
        'ignored.txt': 'throw new Error("Must not be imported")'
    }

    await Promise.all(Object.entries(fixtures).map(([name, source]) =>
        writeFile(join(directory, name), source)
    ))
    await mkdir(join(directory, 'ignored-directory.js'))

    const loader = new CommandLoader(pathToFileURL(`${directory}/`))
    const commands = await loader.load()

    assert.deepEqual(commands.map(command => command.name).sort(), ['Ping', 'special'])
    assert.equal(await commands.find(command => command.name === 'Ping').execute(), 'Pong!')
    assert.equal(warnings.mock.callCount(), 5)
    assert.equal(errors.mock.callCount(), 1)
})

test('registry normalizes names, rejects duplicates and supports removal', () => {
    const ping = { name: 'Ping', execute() {} }
    const stop = { name: 'STOP', execute() {} }
    const registry = new CommandRegistry([ping])

    assert.equal(registry.size, 1)
    assert.equal(registry.get('pING'), ping)
    assert.equal(registry.has('PING'), true)
    assert.equal(registry.get('unknown'), undefined)
    assert.equal(registry.has('unknown'), false)
    assert.throws(() => registry.register({ name: 'PING', execute() {} }), /"ping" is already registered/)
    assert.equal(registry.get('ping'), ping)

    registry.register(stop)
    assert.deepEqual(registry.names(), ['ping', 'stop'])
    assert.deepEqual(registry.all(), [ping, stop])
    registry.names().pop()
    registry.all().pop()
    assert.equal(registry.size, 2)
    assert.equal(registry.unregister('pING'), true)
    assert.equal(registry.unregister('ping'), false)
    assert.equal(registry.has('ping'), false)
    assert.deepEqual(registry.names(), ['stop'])
    assert.equal(registry.size, 1)
    assert.equal(new CommandRegistry().size, 0)
    assert.throws(() => new CommandRegistry([ping, ping]), /already registered/)
})

test('registry rejects invalid commands from any source', () => {
    const registry = new CommandRegistry()

    for (const command of [null, {}, { name: '', execute() {} },
        { name: 1, execute() {} }, { name: 'ping' }]) {
        assert.throws(() => registry.register(command), /nonempty name and an execute function/)
    }

    assert.equal(registry.size, 0)
})

test('manager dispatches parsed commands without a Minecraft chat subscription', async () => {
    const contract = Object.freeze({ reply() {} })
    const executions = []
    const lookups = []
    const command = {
        async execute(context) {
            await Promise.resolve()
            executions.push(context)
        }
    }
    const registry = {
        get(name) {
            lookups.push(name)
            return name === 'ping' ? command : undefined
        }
    }
    const manager = new CommandManager({ bot: { prefix: '!!' } }, contract, { registry })
    await manager.handle('Alice', 'ping ignored')
    await manager.handle('Alice', ' !!ping ignored')
    await manager.handle('Alice', '!!   ')
    await manager.handle('Alice', '!!missing')
    await manager.handle('Alice', '!!  PiNG   first\tsecond  ')

    assert.deepEqual(lookups, ['missing', 'ping'])
    assert.deepEqual(executions, [{ contract, reply: contract.reply, username: 'Alice', args: ['first', 'second'] }])

    await manager.handle('Bob', '!!ping')
    assert.deepEqual(executions[1], { contract, reply: contract.reply, username: 'Bob', args: [] })
})

test('manager isolates synchronous and asynchronous command errors', async t => {
    const errors = t.mock.method(console, 'error', () => {})
    const replies = []
    const contract = Object.freeze({ reply: message => replies.push(message) })
    let completed = 0
    const registry = new CommandRegistry([
        { name: 'sync', execute() { throw new Error('Sync failure') } },
        { name: 'async', async execute() { throw new Error('Async failure') } },
        { name: 'ok', async execute() { completed++ } }
    ])
    const manager = new CommandManager({ bot: { prefix: '!' } }, contract, { registry })
    await manager.handle('Alice', '!sync')
    await manager.handle('Alice', '!async')
    await manager.handle('Alice', '!ok')

    assert.equal(errors.mock.callCount(), 2)
    assert.deepEqual(replies, ['Command execution error.', 'Command execution error.'])
    assert.equal(completed, 1)
})

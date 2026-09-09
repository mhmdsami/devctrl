import assert from 'assert'
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'devctl-test-')))
for (const repo of ['infra', 'api', 'web']) {
  const dir = path.join(root, repo)
  fs.mkdirSync(dir)
  execFileSync('git', ['-C', dir, 'init', '-q'])
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com'])
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'test'])
  fs.writeFileSync(path.join(dir, '.env.test'), 'API_URL=https://api.test.example.com\n')
  fs.writeFileSync(path.join(dir, 'README.md'), 'x\n')
  execFileSync('git', ['-C', dir, 'add', '-A'])
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'init'])
}
const cfg = {
  reposRoot: root,
  herdr: { enabled: false, workspace: 'test' },
  envBaseFiles: { local: '.env.development', test: '.env.test', prod: '.env.production' },
  services: {
    mongo: { repo: 'infra', basePort: 27017, shared: true, command: 'true', healthTimeoutMs: 1000 },
    api: {
      repo: 'api',
      basePort: 3000,
      command: 'true',
      dependsOn: ['mongo'],
      provides: { url: 'http://localhost:${port}/api' },
      remoteProvides: { url: { from: 'web', envKey: 'API_URL' } },
      healthTimeoutMs: 1000,
    },
    web: { repo: 'web', basePort: 3100, command: 'true', wiring: { API_URL: 'api.url' }, healthTimeoutMs: 1000 },
  },
}
fs.writeFileSync(path.join(root, 'devctl.config.json'), JSON.stringify(cfg, null, 2))
process.env.DEVCTL_CONFIG = path.join(root, 'devctl.config.json')

const { depsOf, dependentsOf, resolveWiring, targetFor } = await import('./stacks')
const { listWorktrees } = await import('./registry')

const state = { env: 'test' as const, targets: {} }

assert.deepStrictEqual(targetFor(state, 'web', 'api', { name: 's', services: { api: 'head' } }), { kind: 'local', name: 'head' })
assert.deepStrictEqual(targetFor({ env: 'prod', targets: {} }, 'web', 'api'), { kind: 'remote', mode: 'prod' })
assert.deepStrictEqual(targetFor({ env: 'test', targets: { web: 'api/ft-x' } }, 'web', 'api'), { kind: 'local', name: 'ft-x' })

assert.deepStrictEqual(dependentsOf('api').sort(), ['web'])
assert.deepStrictEqual(dependentsOf('mongo'), ['api'])
assert.deepStrictEqual(dependentsOf('web'), [])

assert.deepStrictEqual(depsOf(state, 'api'), [{ kind: 'service', repo: 'mongo', worktree: null }])
assert.deepStrictEqual(depsOf(state, 'web'), [])
const localWeb = { ...state, targets: { web: 'api/head' } }
assert.deepStrictEqual(depsOf(localWeb, 'web'), [{ kind: 'service', repo: 'api', worktree: 'head' }])

const dbWts = listWorktrees('mongo')
assert.strictEqual(dbWts.length, 1)
assert.strictEqual(dbWts[0].port, 27017)
assert.strictEqual(dbWts[0].name, 'head')

const remote = resolveWiring({ env: 'test', targets: {} }, 'web')
assert.strictEqual(remote.API_URL, 'https://api.test.example.com')

const local = resolveWiring({ env: 'test', targets: { web: 'api/head' } }, 'web')
assert.strictEqual(local.API_URL, 'http://localhost:3000/api')

fs.rmSync(root, { recursive: true, force: true })
console.log('graph self-check passed')

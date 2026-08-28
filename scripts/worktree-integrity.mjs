import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const PHASES = new Set(['start', 'verify', 'finish', 'abort'])
const PROTECTED_BRANCHES = new Set(['main', 'master'])
const CONFLICT_MARKER = /^(?:<{7}|>{7}|\|{7})(?: |$)/m

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: options.cwd,
    encoding: options.binary ? undefined : 'utf8',
    windowsHide: true,
  })

  if (result.error) {
    throw result.error
  }

  if (!options.allowFailure && result.status !== 0) {
    const errorOutput = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
    throw new Error(`git ${args.join(' ')} failed${errorOutput ? `: ${errorOutput}` : ''}`)
  }

  return result
}

function splitNullTerminated(value) {
  return value.toString('utf8').split('\0').filter(Boolean)
}

function isInsideRepository(repositoryRoot, candidate) {
  const relativePath = relative(repositoryRoot, candidate)
  return relativePath !== '..' && !relativePath.startsWith(`..\\`) && !relativePath.startsWith('../') && !isAbsolute(relativePath)
}

export function findConflictMarkerFiles(repositoryRoot, paths) {
  const files = []

  for (const repositoryPath of paths) {
    const absolutePath = resolve(repositoryRoot, repositoryPath)
    if (!isInsideRepository(repositoryRoot, absolutePath)) continue

    let stats
    try {
      stats = lstatSync(absolutePath)
    } catch {
      continue
    }

    if (!stats.isFile() || stats.isSymbolicLink()) continue

    const contents = readFileSync(absolutePath)
    if (contents.includes(0)) continue

    if (containsConflictMarker(contents.toString('utf8'))) {
      files.push(repositoryPath.replaceAll('\\', '/'))
    }
  }

  return files.sort()
}

export function containsConflictMarker(contents) {
  return CONFLICT_MARKER.test(contents)
}

export function evaluateIntegrity(snapshot, phase) {
  if (!PHASES.has(phase)) {
    throw new Error(`Unknown integrity phase: ${phase}`)
  }

  const violations = []
  const isProtectedBranch = PROTECTED_BRANCHES.has(snapshot.branch)

  if (!snapshot.branch) {
    violations.push({ code: 'DETACHED_HEAD', message: 'HEAD must point to a named branch.' })
  }
  if (snapshot.unmergedFiles.length > 0) {
    violations.push({ code: 'UNMERGED_PATHS', message: 'The index contains unresolved merge paths.' })
  }
  if (snapshot.conflictMarkerFiles.length > 0) {
    violations.push({ code: 'CONFLICT_MARKERS', message: 'Changed files contain unresolved conflict markers.' })
  }
  if (!snapshot.diffCheckPassed) {
    violations.push({ code: 'DIFF_CHECK_FAILED', message: 'git diff --check reported an invalid patch.' })
  }

  if (phase === 'start' && snapshot.dirty) {
    violations.push({ code: 'DIRTY_START', message: 'The loop must start from a clean worktree.' })
  }
  if (phase === 'verify' && isProtectedBranch && snapshot.dirty) {
    violations.push({ code: 'DIRTY_PROTECTED_BRANCH', message: 'Modified worktrees are forbidden on main/master.' })
  }
  if (phase === 'finish') {
    if (isProtectedBranch) {
      violations.push({ code: 'PROTECTED_BRANCH_FINISH', message: 'The loop must finish on a task branch.' })
    }
    if (snapshot.dirty) {
      violations.push({ code: 'DIRTY_FINISH', message: 'The loop must finish with a clean worktree.' })
    }
  }

  return {
    phase,
    outcome: phase === 'abort' ? 'ABORT_EVIDENCE' : violations.length === 0 ? 'PASS' : 'BLOCK',
    exitCode: violations.length === 0 ? 0 : 1,
    violations,
  }
}

export function captureIntegritySnapshot(cwd = process.cwd()) {
  const repositoryRoot = runGit(['rev-parse', '--show-toplevel'], { cwd }).stdout.trim()
  const branch = runGit(['branch', '--show-current'], { cwd: repositoryRoot }).stdout.trim()
  const head = runGit(['rev-parse', 'HEAD'], { cwd: repositoryRoot }).stdout.trim()
  const status = runGit(['status', '--porcelain=v1', '-z', '--untracked-files=all'], {
    cwd: repositoryRoot,
    binary: true,
  }).stdout
  const unmergedFiles = splitNullTerminated(
    runGit(['diff', '--name-only', '--diff-filter=U', '-z'], { cwd: repositoryRoot, binary: true }).stdout,
  )
  const changedFiles = new Set([
    ...splitNullTerminated(
      runGit(['diff', '--name-only', '--diff-filter=ACMRTUXB', '-z', 'HEAD', '--'], {
        cwd: repositoryRoot,
        binary: true,
      }).stdout,
    ),
    ...splitNullTerminated(
      runGit(['ls-files', '--others', '--exclude-standard', '-z'], {
        cwd: repositoryRoot,
        binary: true,
      }).stdout,
    ),
  ])
  const diffCheck = runGit(['diff', '--check', 'HEAD', '--'], {
    cwd: repositoryRoot,
    allowFailure: true,
  })
  const binaryDiff = runGit(['diff', '--binary', 'HEAD', '--'], {
    cwd: repositoryRoot,
    binary: true,
  }).stdout

  return {
    repositoryRoot,
    branch,
    head,
    dirty: status.length > 0,
    changedFileCount: changedFiles.size,
    unmergedFiles: unmergedFiles.map((path) => path.replaceAll('\\', '/')).sort(),
    conflictMarkerFiles: findConflictMarkerFiles(repositoryRoot, changedFiles),
    diffCheckPassed: diffCheck.status === 0,
    statusSha256: sha256(status),
    trackedDiffSha256: sha256(binaryDiff),
  }
}

export function buildIntegrityReport(snapshot, phase) {
  const evaluation = evaluateIntegrity(snapshot, phase)
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    ...evaluation,
    repository: {
      branch: snapshot.branch || null,
      head: snapshot.head,
    },
    worktree: {
      dirty: snapshot.dirty,
      changedFileCount: snapshot.changedFileCount,
      unmergedFiles: snapshot.unmergedFiles,
      conflictMarkerFiles: snapshot.conflictMarkerFiles,
      diffCheckPassed: snapshot.diffCheckPassed,
      statusSha256: snapshot.statusSha256,
      trackedDiffSha256: snapshot.trackedDiffSha256,
    },
  }
}

function main() {
  const phase = process.argv[2]
  if (!PHASES.has(phase)) {
    console.error('Usage: node scripts/worktree-integrity.mjs <start|verify|finish|abort>')
    process.exitCode = 2
    return
  }

  try {
    const snapshot = captureIntegritySnapshot()
    const report = buildIntegrityReport(snapshot, phase)
    console.log(JSON.stringify(report, null, 2))
    process.exitCode = report.exitCode
  } catch (error) {
    console.error(JSON.stringify({ phase, outcome: 'ERROR', message: error.message }, null, 2))
    process.exitCode = 2
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null
if (invokedPath === import.meta.url) {
  main()
}

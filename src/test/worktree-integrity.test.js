import { describe, expect, it } from 'vitest'
import {
  buildIntegrityReport,
  containsConflictMarker,
  evaluateIntegrity,
} from '../../scripts/worktree-integrity.mjs'

function snapshot(overrides = {}) {
  return {
    repositoryRoot: '/repo',
    branch: 'fix/KAN-125-loop-integrity',
    head: '221a0c9b972c49ee4e7489c1b298bff7dc08b10b',
    dirty: false,
    changedFileCount: 0,
    unmergedFiles: [],
    conflictMarkerFiles: [],
    diffCheckPassed: true,
    statusSha256: 'status-hash',
    trackedDiffSha256: 'diff-hash',
    ...overrides,
  }
}

describe('worktree integrity phase decisions', () => {
  it('recognizes Git conflict boundaries without treating a separator alone as a conflict', () => {
    expect(containsConflictMarker('<<<<<<< HEAD\ncurrent\n=======\nincoming\n>>>>>>> branch')).toBe(true)
    expect(containsConflictMarker('Documentation heading\n=======\n')).toBe(false)
  })

  it('blocks a dirty worktree at loop start', () => {
    const result = evaluateIntegrity(snapshot({ dirty: true, changedFileCount: 1 }), 'start')

    expect(result.outcome).toBe('BLOCK')
    expect(result.violations).toContainEqual(expect.objectContaining({ code: 'DIRTY_START' }))
  })

  it('blocks modifications on main during verification', () => {
    const result = evaluateIntegrity(snapshot({ branch: 'main', dirty: true }), 'verify')

    expect(result.outcome).toBe('BLOCK')
    expect(result.violations).toContainEqual(expect.objectContaining({ code: 'DIRTY_PROTECTED_BRANCH' }))
  })

  it('blocks unresolved paths and conflict markers in every phase', () => {
    const result = evaluateIntegrity(
      snapshot({
        dirty: true,
        unmergedFiles: ['src/App.jsx'],
        conflictMarkerFiles: ['src/App.jsx'],
      }),
      'verify',
    )

    expect(result.violations.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['UNMERGED_PATHS', 'CONFLICT_MARKERS']),
    )
  })

  it('blocks an invalid patch reported by git diff --check', () => {
    const result = evaluateIntegrity(snapshot({ diffCheckPassed: false }), 'verify')

    expect(result.violations).toContainEqual(expect.objectContaining({ code: 'DIFF_CHECK_FAILED' }))
  })

  it('passes finish only on a clean task branch', () => {
    expect(evaluateIntegrity(snapshot(), 'finish')).toMatchObject({ outcome: 'PASS', exitCode: 0 })

    const protectedResult = evaluateIntegrity(snapshot({ branch: 'main' }), 'finish')
    expect(protectedResult.violations).toContainEqual(
      expect.objectContaining({ code: 'PROTECTED_BRANCH_FINISH' }),
    )
  })

  it('creates read-only abort evidence even when the state is unsafe', () => {
    const report = buildIntegrityReport(
      snapshot({
        dirty: true,
        changedFileCount: 2,
        unmergedFiles: ['src/App.jsx'],
      }),
      'abort',
    )

    expect(report).toMatchObject({
      phase: 'abort',
      outcome: 'ABORT_EVIDENCE',
      exitCode: 1,
      repository: { branch: 'fix/KAN-125-loop-integrity' },
      worktree: {
        dirty: true,
        changedFileCount: 2,
        statusSha256: 'status-hash',
        trackedDiffSha256: 'diff-hash',
      },
    })
    expect(report.violations).toContainEqual(expect.objectContaining({ code: 'UNMERGED_PATHS' }))
  })
})

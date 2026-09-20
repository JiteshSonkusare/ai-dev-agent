import type { RunRecord } from '../api/client'

function loadLocalRuns(): RunRecord[] {
  try {
    return JSON.parse(localStorage.getItem('cc_run_history') ?? '[]')
  } catch {
    return []
  }
}

export function useRunHistory(): RunRecord[] {
  return loadLocalRuns().sort((a, b) => b.started_at - a.started_at)
}

'use client'
import { useState, useMemo } from 'react'

// Click-to-sort for a table's rows, plus an optional free-text filter over
// one or more string fields. `defaultKey`/`defaultDir` set the initial sort
// (e.g. powerScore desc) so a table's usual order is unchanged until someone
// actually clicks a header.
export function useSortableTable(rows, { defaultKey = null, defaultDir = 'desc', filterKeys = [] } = {}) {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState(defaultDir)
  const [filterText, setFilterText] = useState('')

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    if (!q || !filterKeys.length) return rows
    return rows.filter(r => filterKeys.some(k => String(r[k] ?? '').toLowerCase().includes(q)))
  }, [rows, filterText, filterKeys])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const arr = [...filtered]
    arr.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtered, sortKey, sortDir])

  const toggleSort = key => {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  // Spread onto a <th> to make it a working sort control -- click handler
  // plus a ▲/▼ suffix on whichever column is currently active. Deliberately
  // leaves `style` alone (no cursor/userSelect here) so it composes with a
  // page's own header style helper instead of overwriting it when spread
  // after a `style={...}` prop.
  const thSort = (key, label) => ({
    onClick: () => toggleSort(key),
    children: `${label}${sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}`,
  })

  return { rows: sorted, filterText, setFilterText, sortKey, sortDir, toggleSort, thSort }
}

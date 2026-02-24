import { useMemo } from 'react'
import { Label } from '../ui/label'
import { buildDepartmentTree } from '../../lib/queries'
import type { Department } from '../../types'
import { Info } from 'lucide-react'

interface CascadingDepartmentSelectProps {
  /** Full flat list of all departments */
  departments: Department[]
  /** The currently selected department_id (leaf selection) */
  value: string
  onChange: (departmentId: string) => void
  disabled?: boolean
  autoFilledNote?: string
}

/**
 * Dynamic cascading department selector.
 *
 * Shows one <select> for each level of the hierarchy that has been reached.
 * Level 0 = root departments only.
 * Level N = children of the selection at level N-1.
 * A new level appears whenever the selected item at the previous level has children.
 * Changing a level clears all deeper selections.
 */
export function CascadingDepartmentSelect({
  departments,
  value,
  onChange,
  disabled,
  autoFilledNote,
}: CascadingDepartmentSelectProps) {
  const tree = useMemo(() => buildDepartmentTree(departments), [departments])

  /**
   * Reconstructs the full ancestor path for the current value,
   * producing one entry per level that should be rendered.
   * Each entry is { levelItems, selectedId }.
   */
  const levels = useMemo(() => {
    if (!value) {
      return [{ levelItems: tree, selectedId: '' }]
    }

    // Build a map for O(1) lookup
    const map = new Map<string, Department>()
    departments.forEach((d) => map.set(d.id, d))

    // Walk ancestors bottom-up to get the path
    const path: Department[] = []
    let current: Department | undefined = map.get(value)
    while (current) {
      path.unshift(current)
      current = current.parent_id ? map.get(current.parent_id) : undefined
    }

    // Build levels from the path
    const result: { levelItems: Department[]; selectedId: string }[] = []
    let siblings = tree // starts with roots

    for (const dept of path) {
      result.push({ levelItems: siblings, selectedId: dept.id })
      // Next level's siblings = children of this selection (with children from tree)
      const nodeInTree = findInTree(tree, dept.id)
      siblings = nodeInTree?.children ?? []
    }

    // If the last selected item has children, add an empty level for them
    const lastSelected = path[path.length - 1]
    if (lastSelected) {
      const nodeInTree = findInTree(tree, lastSelected.id)
      if (nodeInTree?.children && nodeInTree.children.length > 0) {
        result.push({ levelItems: nodeInTree.children, selectedId: '' })
      }
    }

    return result
  }, [value, departments, tree])

  const handleLevelChange = (levelIndex: number, selectedId: string) => {
    // If empty selected, propagate the selection of the level above
    if (!selectedId) {
      if (levelIndex === 0) {
        onChange('')
      } else {
        // Keep selection at levelIndex - 1 (parent)
        const parentId = levels[levelIndex - 1].selectedId
        onChange(parentId)
      }
      return
    }
    onChange(selectedId)
  }

  const levelLabel = (index: number) => {
    if (index === 0) return 'Department'
    return 'Sub-department'
  }

  return (
    <div className="space-y-3">
      {levels.map(({ levelItems, selectedId }, index) => (
        <div key={index} className="space-y-1.5">
          <Label htmlFor={`dept-level-${index}`} className="flex items-center gap-2">
            {levelLabel(index)}
            {index === 0 && autoFilledNote && (
              <span className="text-xs text-muted-foreground font-normal">{autoFilledNote}</span>
            )}
          </Label>
          <select
            id={`dept-level-${index}`}
            value={selectedId}
            onChange={(e) => handleLevelChange(index, e.target.value)}
            disabled={disabled}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">
              {index === 0 ? 'No Department' : '— None (stay at parent level) —'}
            </option>
            {levelItems.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      ))}
      {autoFilledNote && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>Department automatically set from manager. You can change it if needed.</span>
        </div>
      )}
    </div>
  )
}

/** Recursively finds a department node in the tree by id */
function findInTree(nodes: Department[], id: string): Department | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findInTree(node.children, id)
      if (found) return found
    }
  }
  return undefined
}

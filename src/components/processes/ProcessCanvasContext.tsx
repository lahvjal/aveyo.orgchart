import { createContext, useContext } from 'react'
import type { Profile, Department } from '../../types'

export interface ProcessCanvasContextType {
  isEditing: boolean
  allProfiles: Profile[]
  allDepartments: Department[]
  onLabelChange: (id: string, label: string) => void
  onDescriptionChange: (id: string, description: string) => void
  onDelete: (id: string) => void
  onUpdateTaggedProfiles: (nodeId: string, profileIds: string[]) => void
  onUpdateTaggedDepartments: (nodeId: string, departmentIds: string[]) => void
}

export const ProcessCanvasContext = createContext<ProcessCanvasContextType | null>(null)

export function useProcessCanvasContext(): ProcessCanvasContextType {
  const ctx = useContext(ProcessCanvasContext)
  if (!ctx) throw new Error('useProcessCanvasContext must be used inside ProcessCanvas')
  return ctx
}

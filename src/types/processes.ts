import type { Profile } from './index'
export type { Profile }

export type ProcessNodeType =
  | 'start'
  | 'end'
  | 'task'
  | 'decision'
  | 'document'
  | 'approval'
  | 'notification'

export interface Process {
  id: string
  name: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ProcessNode {
  id: string
  process_id: string
  node_type: ProcessNodeType
  label: string
  description: string | null
  x_position: number
  y_position: number
  tagged_profile_ids: string[]
  created_at: string
}

export interface ProcessEdge {
  id: string
  process_id: string
  source_node_id: string
  target_node_id: string
  label: string | null
  created_at: string
}

export interface ProcessNodeTypeConfig {
  type: ProcessNodeType
  label: string
  color: string
  accentColor: string
}

export const PROCESS_NODE_TYPE_CONFIGS: ProcessNodeTypeConfig[] = [
  { type: 'start',        label: 'Start',        color: '#22c55e', accentColor: '#16a34a' },
  { type: 'end',          label: 'End',          color: '#ef4444', accentColor: '#dc2626' },
  { type: 'task',         label: 'Task',         color: '#3b82f6', accentColor: '#2563eb' },
  { type: 'decision',     label: 'Decision',     color: '#f59e0b', accentColor: '#d97706' },
  { type: 'document',     label: 'Document',     color: '#8b5cf6', accentColor: '#7c3aed' },
  { type: 'approval',     label: 'Approval',     color: '#06b6d4', accentColor: '#0891b2' },
  { type: 'notification', label: 'Notification', color: '#f97316', accentColor: '#ea580c' },
]

export function getNodeTypeConfig(type: ProcessNodeType): ProcessNodeTypeConfig {
  return PROCESS_NODE_TYPE_CONFIGS.find((c) => c.type === type) ?? PROCESS_NODE_TYPE_CONFIGS[2]
}

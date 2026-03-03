import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Decision = 'allow' | 'deny'

interface MatrixFile {
  roles: string[]
  sql: Record<string, Record<string, Decision>>
  edge: Record<string, Record<string, Decision>>
  ui: Record<string, Record<string, string>>
}

function loadMatrix(): MatrixFile {
  const file = resolve(process.cwd(), 'authz-regression-matrix.json')
  return JSON.parse(readFileSync(file, 'utf-8')) as MatrixFile
}

describe('authz regression matrix', () => {
  const matrix = loadMatrix()

  it('keeps role coverage complete for SQL scenarios', () => {
    for (const scenario of Object.values(matrix.sql)) {
      for (const role of matrix.roles) {
        expect(scenario[role]).toBeDefined()
        expect(['allow', 'deny']).toContain(scenario[role])
      }
    }
  })

  it('keeps role coverage complete for edge scenarios', () => {
    for (const scenario of Object.values(matrix.edge)) {
      for (const role of matrix.roles) {
        expect(scenario[role]).toBeDefined()
        expect(['allow', 'deny']).toContain(scenario[role])
      }
    }
  })

  it('preserves key privilege-escalation denials', () => {
    expect(matrix.sql.profiles_self_update_privileged_columns.authenticated).toBe('deny')
    expect(matrix.sql.profiles_self_update_privileged_columns.manager).toBe('deny')
    expect(matrix.edge.admin_user_ops_update_profile_manager_privileged_fields.manager).toBe('deny')
    expect(matrix.edge.send_invitation_email_body_spoofed_userid.authenticated).toBe('deny')
  })
})

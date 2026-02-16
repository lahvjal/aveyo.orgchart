import { useState } from 'react'
import { useDepartments, useCreateDepartment, useUpdateDepartment } from '../../lib/queries'
import type { Department } from '../../types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Plus, Edit2, Loader2 } from 'lucide-react'

export function DepartmentManager() {
  const { data: departments, isLoading } = useDepartments()
  const createDepartment = useCreateDepartment()
  const updateDepartment = useUpdateDepartment()

  const [isEditing, setIsEditing] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    color: '#6366f1',
    description: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editingDept) {
      await updateDepartment.mutateAsync({
        id: editingDept.id,
        ...formData,
      })
    } else {
      await createDepartment.mutateAsync(formData)
    }

    // Reset form
    setFormData({ name: '', color: '#6366f1', description: '' })
    setIsEditing(false)
    setEditingDept(null)
  }

  const handleEdit = (dept: Department) => {
    setEditingDept(dept)
    setFormData({
      name: dept.name,
      color: dept.color,
      description: dept.description || '',
    })
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditingDept(null)
    setFormData({ name: '', color: '#6366f1', description: '' })
  }

  if (isLoading) {
    return <div>Loading departments...</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {isEditing ? (editingDept ? 'Edit Department' : 'Add Department') : 'Departments'}
          </CardTitle>
          <CardDescription>
            {isEditing
              ? 'Configure department details and color coding'
              : 'Manage organization departments'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Department Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="e.g., Engineering"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Color *</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="w-20 h-10"
                    required
                  />
                  <Badge style={{ backgroundColor: formData.color, color: 'white' }}>
                    Preview
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={createDepartment.isPending || updateDepartment.isPending}
                >
                  {(createDepartment.isPending || updateDepartment.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingDept ? 'Update' : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <Button onClick={() => setIsEditing(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Department
              </Button>

              <div className="space-y-2">
                {departments?.map((dept) => (
                  <div
                    key={dept.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge style={{ backgroundColor: dept.color, color: 'white' }}>
                        {dept.name}
                      </Badge>
                      {dept.description && (
                        <span className="text-sm text-muted-foreground">{dept.description}</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(dept)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useRouter } from 'next/navigation'

interface User {
  id: number
  username: string
  role: string
  createdAt: string
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ username: '', password: '', role: 'user' })

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers()
    }
  }, [user])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setEditForm({ username: user.username, password: '', role: user.role })
  }

  const handleCancelEdit = () => {
    setEditingUser(null)
    setEditForm({ username: '', password: '', role: 'user' })
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return

    try {
      const updateData: any = { role: editForm.role }
      
      if (editForm.username !== editingUser.username) {
        updateData.username = editForm.username
      }
      
      if (editForm.password) {
        updateData.password = editForm.password
      }

      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        await fetchUsers()
        handleCancelEdit()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to update user')
      }
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Failed to update user')
    }
  }

  const handleDelete = async (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchUsers()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-[#a0a0b8]">Loading...</div>
      </div>
    )
  }

  if (!user || user.role !== 'admin') {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-white">User Management</h1>

      <div className="bg-[#15151e] rounded-2xl border border-[#2a2a38] overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="bg-[#1c1c28] border-b border-[#2a2a38]">
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2a38]">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-[#1c1c28] transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                  {u.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                  {u.username}
                  {u.username === user.username && (
                    <span className="ml-2 px-2 py-1 bg-[#00ceb8]/20 text-[#00ceb8] text-xs rounded-full font-medium">
                      You
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    u.role === 'admin' 
                      ? 'bg-[#9d4edd]/20 text-[#9d4edd]' 
                      : 'bg-[#1c1c28] text-[#a0a0b8] border border-[#2a2a38]'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[#a0a0b8]">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleEdit(u)}
                    className="text-[#00ceb8] hover:text-[#00b5a1] font-medium mr-4 transition-colors"
                  >
                    Edit
                  </button>
                  {u.username !== user.username && (
                    <button
                      onClick={() => handleDelete(u.id, u.username)}
                      className="text-[#f5365c] hover:text-[#d82947] font-medium transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#15151e] rounded-2xl border border-[#2a2a38] p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-white">
              Edit User: {editingUser.username}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#a0a0b8] mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="w-full px-4 py-2 bg-[#1c1c28] border border-[#2a2a38] rounded-xl text-white placeholder-[#6a6a82] focus:outline-none focus:ring-2 focus:ring-[#00ceb8] focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#a0a0b8] mb-2">
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-4 py-2 bg-[#1c1c28] border border-[#2a2a38] rounded-xl text-white placeholder-[#6a6a82] focus:outline-none focus:ring-2 focus:ring-[#00ceb8] focus:border-transparent transition-all"
                  placeholder="Leave blank to keep current"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#a0a0b8] mb-2">
                  Role
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-4 py-2 bg-[#1c1c28] border border-[#2a2a38] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#00ceb8] focus:border-transparent transition-all"
                  disabled={editingUser.username === user.username}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                {editingUser.username === user.username && (
                  <p className="text-xs text-[#6a6a82] mt-2">
                    You cannot change your own role
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={handleCancelEdit}
                className="btn-gradient-dark px-4 py-2 rounded-xl text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="btn-gradient-primary px-4 py-2 text-white rounded-xl font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

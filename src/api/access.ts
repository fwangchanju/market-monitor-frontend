import { z } from 'zod'
import client from './client'

const adminStatusResponseSchema = z.object({ isAdmin: z.boolean() })

export const getAdminStatus = () =>
  client.get('/access/admin-status').then(r => adminStatusResponseSchema.parse(r.data).isAdmin)

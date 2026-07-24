import client from './client'
import { AllowedIpItemSchema } from '@/types/api'
import { z } from 'zod'

const allowedIpListResponseSchema = z.array(AllowedIpItemSchema)

export const getAllowedIps = () =>
  client.get('/admin/allowed-ips').then(r => allowedIpListResponseSchema.parse(r.data))

export const registerAllowedIp = (ip: string) => client.post(`/admin/allowed-ips/${ip}`)

export const deleteAllowedIp = (ip: string) => client.delete(`/admin/allowed-ips/${ip}`)

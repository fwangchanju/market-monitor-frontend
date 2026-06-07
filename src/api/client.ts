import axios from 'axios'

const client = axios.create({
  baseURL: '/market-monitor/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export default client

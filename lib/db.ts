import pg from 'pg'

const { Pool } = pg

// Ensure a single connection pool is used in development mode to prevent connection exhaustion
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME || 'labeling_tool',
  user: process.env.DB_USER || 'labeling_tool_ec2_user',
  password: process.env.DB_PASSWORD || 'LabelingToolEc2User@019283',
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10, // maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

export async function query(text: string, params?: any[]) {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    console.log(`[db] query executed in ${duration}ms: ${text.slice(0, 100)}`)
    return res
  } catch (error) {
    console.error('[db] query execution error:', error)
    throw error
  }
}

export default pool

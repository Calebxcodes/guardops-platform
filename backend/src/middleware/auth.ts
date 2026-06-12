import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { tenantStorage } from '../db/pool'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set. Refusing to start.')

export interface AuthRequest extends Request {
  guardId?: number
  guard?: any
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const token = auth.slice(7)
    const payload = jwt.verify(token, JWT_SECRET) as any
    req.guardId = payload.guardId
    req.guard = payload
    if (payload.tenantId) {
      tenantStorage.run(Number(payload.tenantId), () => next())
    } else {
      next()
    }
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' })
  }
}

export function signToken(guardId: number, email: string, tenantId?: number) {
  const payload: any = { guardId, email }
  if (tenantId) payload.tenantId = tenantId
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
}

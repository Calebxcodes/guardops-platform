import { Response, NextFunction } from 'express'

export function preventSelfDemotion(req: any, res: Response, next: NextFunction) {
  const targetUserId = parseInt(req.params.userId, 10)
  const currentUserId = req.adminId

  if (targetUserId === currentUserId) {
    return res.status(400).json({
      success: false,
      message: 'You cannot change your own role. Ask another owner to do this.',
    })
  }

  next()
}

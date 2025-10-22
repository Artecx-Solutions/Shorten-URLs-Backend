import { Router } from 'express';
import * as os from 'os'

const router = Router();
/** GET /api/health */
router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    hostname: os.hostname(),
    timestamp: new Date().toISOString()
  });
});

export default router;

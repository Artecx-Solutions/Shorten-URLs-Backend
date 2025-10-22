import { Router } from 'express';
import { fetchMetadata } from '../controllers/metadata.controller';

const router = Router();
// POST /api/metadata  { url }
router.post('/', fetchMetadata);

export default router;

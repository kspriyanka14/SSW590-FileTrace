import express from 'express';
import { filesData, auditLogsData } from '../data/index.js';
import { auth } from '../middleware/index.js';
import { fileIdSchema } from '../validation/index.js';

const router = express.Router();

/**
 * GET /api/audit/file/:fileId
 * Get audit logs for a specific file
 */
router.get('/file/:fileId', auth, async (req, res) => {
  try {
    const { fileId } = fileIdSchema.parse(req.params);

    // Verify file exists and ownership
    const file = await filesData.getFileById(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.ownerId.toString() !== req.user.userId) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get audit logs
    const logs = await auditLogsData.getAuditLogsByFile(fileId);

    res.status(200).json({ logs });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
    }

    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

export default router;

import { auditLogsData } from '../data/index.js';

/**
 * Extracts client IP address from request headers
 *
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    'Unknown'
  );
};

/**
 * Extracts geographic location from Cloudflare headers
 *
 * @param {Object} req - Express request object
 * @returns {string|undefined} Geographic location code
 */
const getLocation = (req) => {
  return req.headers['cf-ipcountry'];
};

/**
 * Audit Logger Middleware Factory
 * Creates middleware that logs actions to audit trail
 *
 * @param {string} action - Action type to log
 * @param {Function} [detailsExtractor] - Optional function to extract action-specific details
 * @returns {Function} Express middleware function
 * @example
 * router.post('/upload', auth, auditLogger('UPLOAD'), uploadHandler);
 * router.patch('/:id/rename', auth, auditLogger('NAME_CHANGE', (req) => ({
 *   oldFilename: req.body.oldFilename,
 *   newFilename: req.body.newFilename
 * })), renameHandler);
 */
const auditLogger = (action, detailsExtractor) => {
  return async (req, res, next) => {
    // Store original send function
    const originalSend = res.send;

    // Override send to intercept response
    res.send = function (data) {
      // Restore original send
      res.send = originalSend;

      // Log audit entry asynchronously (don't block response)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Extract file ID from various possible locations
        const fileId =
          req.params.fileId ||
          req.body.fileId ||
          req.file?.fileId ||
          res.locals.fileId;

        if (fileId || action === 'EXPIRED_LINK_ATTEMPT') {
          const auditData = {
            fileId: fileId || null,
            action,
            userId: req.user?.userId,
            username: req.user?.username,
            ipAddress: getClientIp(req),
            location: getLocation(req),
            details: detailsExtractor ? detailsExtractor(req, res) : undefined,
          };

          // Log asynchronously without blocking response
          auditLogsData.createAuditLog(auditData).catch((error) => {
            console.error('Failed to create audit log:', error);
          });
        }
      }

      // Send response
      return originalSend.call(this, data);
    };

    next();
  };
};

export default auditLogger;

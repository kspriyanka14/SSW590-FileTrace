/**
 * Routes configuration
 * Configures all API routes for the application
 */

import authRoutes from './auth.js';
import filesRoutes from './files.js';
import shareRoutes from './share.js';
import auditRoutes from './audit.js';

/**
 * Configures all application routes
 *
 * @param {Object} app - Express application instance
 */
const configRoutes = (app) => {
  app.use('/api/auth', authRoutes);
  app.use('/api/files', filesRoutes);
  app.use('/api/share', shareRoutes);
  app.use('/api/audit', auditRoutes);

  // 404 handler for all undefined routes (Express v5 catch-all syntax)
  app.use('/{*splat}', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
};

export default configRoutes;

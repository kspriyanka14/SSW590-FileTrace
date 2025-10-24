# FileTrace
FileTrace is an audit-first file management platform that enables users to securely upload, organize, and share files through a web interface with comprehensive activity tracking. The application implements fundamental security practices including user authentication with password strength requirements, server-side file encryption, categorized file organization (Personal, Work, Documents, Archive), and secure file sharing with configurable expiration dates and access limits. What distinguishes FileTrace from typical consumer storage solutions is its emphasis on transparency through detailed audit logging. Every action performed on a file is recorded and made visible to users, providing complete insight into upload times, download events, sharing activities, and access patterns. Users can view comprehensive audit trails for their files, create time-limited shareable links with maximum access counts, and monitor exactly when their shared content was accessed. This approach to file management prioritizes security visibility and accountability, offering users the operational awareness typically found in enterprise systems rather than personal storage applications.

## Sample Task: CI/CD Platform Comparison
This project serves as a comprehensive DevSecOps comparison study evaluating GitHub Actions versus GitLab CI/CD for deploying security-conscious applications. Both CI/CD platforms will implement identical workflows including automated dependency vulnerability scanning using npm audit, containerized environments through Docker, secure environment variable management, and automated deployment pipelines with security validation gates. The comparison will focus on several key dimensions: deployment reliability and consistency, security integration capabilities, secrets management effectiveness, build performance metrics, and overall developer experience. We will analyze the strengths and weaknesses of each platform through hands-on implementation, documenting setup complexity, maintenance requirements, pipeline debugging difficulty, and the availability of security features within free tier limits. The goal is to determine which CI/CD approach better supports modern DevSecOps practices for small teams working with limited budgets.

## DevSecOps Tools and Environment
### CI/CD & Version Control
- GitHub Actions - Primary CI/CD platform for comparison
- GitLab CI/CD - Secondary CI/CD platform for comparison
- Git - Version control system
- Docker - Containerization and consistent build environments
### Security Tools
- npm audit - Automated dependency vulnerability scanning
- bcrypt - Password hashing library
- jsonwebtoken (JWT) - Secure authentication token generation
- helmet - Express.js security headers middleware
- CORS - Cross-origin resource sharing security
### Cloud Infrastructure & Deployment
- AWS S3 - Static website hosting (frontend) and file storage with server-side encryption
- AWS EC2 - Backend API hosting (free tier t2.micro)
- AWS CloudWatch - Infrastructure monitoring (CPU, memory, network metrics)
### Database & Storage
- MongoDB Atlas - Cloud database (M0 free tier, 512MB storage)
- Mongoose - MongoDB object modeling for Node.js
### Development Tools
- Node.js 22.x LTS - Backend runtime environment
- Express.js - Web application framework
- React 19.x - Frontend JavaScript library
- Tailwind CSS - Utility-first CSS framework
- Axios - HTTP client for API requests
### Testing Tools
- Jest - Unit and integration testing framework
- Postman - API endpoint testing and documentation
- Cypress - End-to-end testing for web applications
### Monitoring & Operations
- AWS CloudWatch - Infrastructure metrics and log aggregation
- MongoDB Atlas Dashboard - Database performance monitoring
- Application Audit Logs - Custom logging system stored in MongoDB for security analysis

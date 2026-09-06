# Chama App

A comprehensive platform for managing chamas in Kenya and East Africa. The system supports multiple chama types including SAVINGS, ROSCA, INVESTMENT, WELFARE, BUSINESS, HOUSING, FAMILY, CHURCH, YOUTH, STAFF, FARMERS, WOMEN, MEN, COMMUNITY, and HYBRID with financial management, governance tools, and multi-platform access.

## Features

- **Multi-type support**: SAVINGS, ROSCA, INVESTMENT, WELFARE, BUSINESS, HOUSING, FAMILY, CHURCH, YOUTH, STAFF, FARMERS, WOMEN, MEN, COMMUNITY, and HYBRID
- **Financial Management**: Contributions, loans, payouts, and share-outs
- **Dispute Resolution**: Structured dispute handling with evidence management
- **Governance**: Voting mechanisms and meeting management
- **Security**: JWT authentication, role-based access control, audit trails
- **Payments**: M-Pesa integration for mobile money transactions
- **Notifications**: Multi-channel notifications (SMS, email, in-app)
- **Offline Support**: Offline functionality with data synchronization
- **Compliance**: KYC verification and regulatory reporting

## Technology Stack

- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for session management and caching
- **Authentication**: JWT with refresh token rotation
- **Validation**: Zod schemas for runtime type validation
- **Testing**: Jest with fast-check for property-based testing
- **Queue**: Bull/BullMQ for background job processing
- **Storage**: S3-compatible storage for documents

## Prerequisites

- Node.js 22+ and npm 10+
- PostgreSQL 13+
- Redis 6+
- Docker and Docker Compose (optional, for containerized development)

## Quick Start

### Using Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd organization-platform
   ```

2. **Start the development environment**
   ```bash
   # Start PostgreSQL and Redis
   docker-compose --profile development up -d postgres-dev redis
   
   # Wait for services to be ready
   docker-compose logs -f postgres-dev redis
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   
   # Seed the database with test data
   npm run db:seed
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

### Manual Setup

1. **Install and start PostgreSQL**
   ```bash
   # Create database
   createdb organization_platform
   ```

2. **Install and start Redis**
   ```bash
   redis-server
   ```

3. **Follow steps 3-6 from Docker setup**

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:pbt` - Run property-based tests only
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

### Database Commands

- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database with test data

### Testing

The project uses a dual testing approach:

1. **Unit Tests**: Test specific examples and edge cases
2. **Property-Based Tests**: Test universal properties across all inputs

```bash
# Run all tests
npm test

# Run only unit tests
npm test -- --testPathIgnorePattern=pbt.test.ts

# Run only property-based tests
npm run test:pbt

# Run tests with coverage
npm run test:coverage
```

### Environment Variables

Copy `.env.example` to `.env` and configure the following:

#### Required Variables
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (min 32 characters)
- `JWT_REFRESH_SECRET` - JWT refresh token secret (min 32 characters)
- `SESSION_SECRET` - Session secret (min 32 characters)
- `IDENTITY_HASH_SECRET` - Dedicated high-entropy key for national-ID fingerprints (min 32 characters)
- `MFA_ENCRYPTION_KEY` - Dedicated 32-byte MFA encryption key encoded as 64 hexadecimal characters

#### Optional Variables
- `REDIS_URL` - Redis connection string
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production/test)

See `.env.example` for all available configuration options.

## API Documentation

### Health Checks

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check with service status
- `GET /health/ready` - Readiness probe (for Kubernetes)
- `GET /health/live` - Liveness probe (for Kubernetes)

### Authentication

Authentication endpoints will be available after implementing the authentication system.

## Project Structure

```
src/
â”œâ”€â”€ config/          # Configuration files
â”‚   â”œâ”€â”€ database.ts  # Prisma database configuration
â”‚   â”œâ”€â”€ redis.ts     # Redis configuration and utilities
â”‚   â”œâ”€â”€ logger.ts    # Winston logger configuration
â”‚   â””â”€â”€ environment.ts # Environment validation and config
â”œâ”€â”€ middleware/      # Express middleware
â”œâ”€â”€ routes/          # API route handlers
â”œâ”€â”€ services/        # Business logic services
â”œâ”€â”€ utils/           # Utility functions
â”œâ”€â”€ types/           # TypeScript type definitions
â””â”€â”€ scripts/         # Database seeds and utilities

tests/
â”œâ”€â”€ setup.ts         # Test configuration and utilities
â”œâ”€â”€ integration/     # Integration tests
â””â”€â”€ **/*.test.ts     # Unit tests (co-located with source)

prisma/
â””â”€â”€ schema.prisma    # Database schema definition
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow the existing ESLint and Prettier configuration
- Write tests for all new functionality
- Use property-based tests for complex business logic
- Follow the existing project structure and naming conventions

## Deployment

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Docker Production

```bash
# Create the untracked production environment file and replace every placeholder.
cp .env.example .env.production

# Verify configuration before building.
npm run release:check

# Build and start production containers
docker-compose --profile production up -d
```

### Environment Setup

1. Set up production PostgreSQL and Redis instances
2. Configure `.env.production` using secrets from the deployment secret manager
3. Run database migrations: `npx prisma migrate deploy`
4. Start the application: `npm start`

## Security

- All passwords are hashed using bcrypt
- JWT tokens with refresh token rotation
- Rate limiting on all endpoints
- Input validation using Zod schemas
- SQL injection protection via Prisma ORM
- CORS configuration for cross-origin requests
- Helmet.js for security headers

## Monitoring and Logging

- Structured logging with Winston
- Health check endpoints for monitoring
- Error tracking and reporting
- Performance metrics collection
- Audit trails for all financial operations

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please open an issue in the GitHub repository.

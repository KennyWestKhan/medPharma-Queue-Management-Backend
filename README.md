# MedPharma Queue Management - Backend

An Express.js backend service with real-time WebSocket communication for managing patient consultation queues.

## 🚀 Features

- **RESTful API**: Complete CRUD operations for patients, doctors, and queue management
- **Real-time Communication**: WebSocket integration with Socket.io for live updates
- **PostgreSQL Database**: Reliable data persistence with optimized queries
- **Input Validation**: Comprehensive request validation using express-validator
- **Rate Limiting**: Protection against API abuse with configurable limits
- **Error Handling**: Consistent error responses and logging
- **API Documentation**: Interactive Swagger/OpenAPI documentation
- **Health Monitoring**: Built-in health checks and system status endpoints

## 📋 Prerequisites

- **Node.js** (v16.0.0 or higher)
- **PostgreSQL** (v12 or higher)
- **npm** (v8.0.0 or higher)

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
# Navigate to backend directory
cd medp-backend

# Install dependencies
npm install
```

### 2. Database Setup

**Manual Setup**

```bash
# Connect to PostgreSQL
psql -U postgres -h localhost

# Create database
CREATE DATABASE medp_queue;

# Exit psql
\q

# Run schema
psql -U postgres -h localhost -d medp_queue -f docs/medp_schema.sql
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
notepad .env  # Windows
nano .env     # Linux/Mac
```

**Environment Variables:**

```bash
# Server Configuration
NODE_ENV=development
PORT=3001

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_NAME=medp_queue

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🏃‍♂️ Running the Application

### Development Mode

```bash
# Start development server with auto-reload
npm run dev

# Or using node
npm start
```

### Production Mode

```bash
# Set environment
NODE_ENV=development

# Start production server
npm start
```

### Using Docker

```bash
# Start with Docker Compose (includes PostgreSQL)
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

## 📡 API Endpoints

### Base URL

- **Development**: `http://localhost:3001/api`
- **Production**: `https://medPharma-domain.com/api`

### Queue Management

| Method   | Endpoint                             | Description               |
| -------- | ------------------------------------ | ------------------------- |
| `POST`   | `/queue/add-patient`                 | Add patient to queue      |
| `GET`    | `/queue/patient/:patientId/status`   | Get patient queue status  |
| `PATCH`  | `/queue/patient/:patientId/status`   | Update patient status     |
| `DELETE` | `/queue/patient/:patientId`          | Remove patient from queue |
| `GET`    | `/queue/doctor/:doctorId`            | Get doctor's queue        |
| `GET`    | `/queue/doctor/:doctorId/statistics` | Get queue statistics      |

### Doctor Management

| Method  | Endpoint                          | Description                 |
| ------- | --------------------------------- | --------------------------- |
| `GET`   | `/doctors`                        | Get all doctors             |
| `GET`   | `/doctors/:doctorId`              | Get doctor details          |
| `PATCH` | `/doctors/:doctorId/availability` | Update availability         |
| `GET`   | `/doctors/:doctorId/queue`        | Get doctor's detailed queue |
| `GET`   | `/doctors/available/list`         | Get available doctors only  |

### Patient Management

| Method   | Endpoint                            | Description               |
| -------- | ----------------------------------- | ------------------------- |
| `GET`    | `/patients/:patientId`              | Get patient information   |
| `GET`    | `/patients/:patientId/queue-status` | Get detailed queue status |
| `PATCH`  | `/patients/:patientId/status`       | Update patient status     |
| `DELETE` | `/patients/:patientId`              | Remove patient from queue |

### System

| Method | Endpoint                     | Description          |
| ------ | ---------------------------- | -------------------- |
| `GET`  | `/health`                    | System health check  |
| `GET`  | `/queue/health`              | Queue service health |
| `POST` | `/queue/maintenance/cleanup` | Clean old records    |

## 📚 API Documentation

### Interactive Documentation (Swagger)

Visit the interactive API documentation:

- **Development**: http://localhost:3001/api-docs
- **Production**: https://your-domain.com/api-docs

### Example Requests

#### Add Patient to Queue

```bash
curl -X POST http://localhost:3001/api/queue/add-patient \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "doctorId": "doc1",
    "estimatedDuration": 15
  }'
```

#### Get Patient Status

```bash
curl http://localhost:3001/api/queue/patient/123e4567-e89b-12d3-a456-426614174000/status
```

#### Update Doctor Availability

```bash
curl -X PATCH http://localhost:3001/api/doctors/doc1/availability \
  -H "Content-Type: application/json" \
  -d '{"isAvailable": false}'
```

## 🔌 WebSocket Events

### Connection URL

```javascript
const socket = io("http://localhost:3001");
```

### Client-to-Server Events

| Event                      | Description         | Payload                   |
| -------------------------- | ------------------- | ------------------------- |
| `joinPatientRoom`          | Join patient room   | `{patientId, doctorId}`   |
| `joinDoctorRoom`           | Join doctor room    | `{doctorId}`              |
| `updatePatientStatus`      | Update status       | `{patientId, status}`     |
| `updateDoctorAvailability` | Update availability | `{doctorId, isAvailable}` |

### Server-to-Client Events

| Event                      | Description            | Payload                                    |
| -------------------------- | ---------------------- | ------------------------------------------ |
| `queueUpdate`              | Queue position changed | `{patientId, position, estimatedWaitTime}` |
| `patientStatusUpdated`     | Patient status changed | `{patientId, status}`                      |
| `queueChanged`             | Queue modified         | `{queue: Patient[]}`                       |
| `doctorAvailabilityUpdate` | Doctor availability    | `{doctorId, isAvailable}`                  |

## 🗃️ Database Schema

### Tables

#### Doctors

```sql
- id (VARCHAR, Primary Key)
- name (VARCHAR, NOT NULL)
- specialization (VARCHAR, NOT NULL)
- is_available (BOOLEAN, DEFAULT true)
- average_consultation_time (INTEGER, DEFAULT 15)
- consultation_fee (DECIMAL)
- bio (TEXT)
- created_at, updated_at (TIMESTAMP)
```

#### Patients

```sql
- id (UUID, Primary Key)
- name (VARCHAR, NOT NULL)
- doctor_id (VARCHAR, Foreign Key)
- status (ENUM: waiting, next, consulting, completed, late)
- joined_at (TIMESTAMP, NOT NULL)
- consultation_started_at (TIMESTAMP, nullable)
- consultation_ended_at (TIMESTAMP, nullable)
- created_at, updated_at (TIMESTAMP)
```

### Sample Data

The schema includes 5 sample doctors:

- Dr. Prince Bondzie (General Medicine) - Available
- Dr. Yaw Asamoah (Cardiology) - Available
- Dr. Hughes Debazaa (Pediatrics) - Unavailable
- Dr. Kiki Smith (Dermatology) - Available
- Dr. Jemilu Mohammed (Internal Medicine) - Available

## 🔧 Configuration

### Environment Variables

| Variable                  | Description           | Default       | Required |
| ------------------------- | --------------------- | ------------- | -------- |
| `NODE_ENV`                | Environment mode      | `development` | No       |
| `PORT`                    | Server port           | `3001`        | No       |
| `DB_HOST`                 | Database host         | `localhost`   | Yes      |
| `DB_PORT`                 | Database port         | `5432`        | No       |
| `DB_USER`                 | Database user         | `postgres`    | Yes      |
| `DB_PASSWORD`             | Database password     | -             | Yes      |
| `DB_NAME`                 | Database name         | `medp_queue`  | Yes      |
| `RATE_LIMIT_MAX_REQUESTS` | Rate limit per window | `100`         | No       |

## 📈 Performance & Monitoring

### Performance Optimization

- **Database Connection Pooling**: Configured PostgreSQL connection pool
- **Query Optimization**: Indexed frequently queried columns
- **Rate Limiting**: Prevents API abuse
- **Compression**: Gzip compression for responses
- **Caching**: In-memory caching for frequently accessed data

### Monitoring Endpoints

```bash
# System health
GET /health

# Database health
GET /api/queue/health

# Queue statistics
GET /api/queue/dashboard/stats
```

### Metrics

Monitor these key metrics:

- **Response Time**: Average API response time
- **Error Rate**: 4xx and 5xx error percentages
- **Database Connections**: Active connection count
- **WebSocket Connections**: Active socket connections
- **Queue Length**: Average patients in queue per doctor

## 🔒 Security

### Security Features

- **Input Validation**: All inputs validated and sanitized
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS Configuration**: Configured for specific origins
- **Helmet.js**: Security headers applied
- **SQL Injection Prevention**: Parameterized queries only
- **XSS Protection**: Input sanitization

### Security Checklist

- [ ] Use HTTPS in production
- [ ] Set strong environment variables
- [ ] Configure firewall rules
- [ ] Enable database SSL
- [ ] Set up monitoring and alerting
- [ ] Regular security updates
- [ ] Backup and recovery procedures

## 🚀 Deployment

1. **Environment Setup**

   ```bash
   NODE_ENV=development
   PORT=3001
   DATABASE_URL=postgresql://user:pass@host:port/db
   ```

2. **Database Migration**

   ```bash
   # Run schema in production database
   psql $DATABASE_URL -f medp_schema.sql
   ```

3. **Process Management (PM2)**
   ```bash
   npm install -g pm2
   pm2 start server.js --name medp-backend
   pm2 save
   pm2 startup
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Health Checks

```bash
# Application health
curl http://localhost:3001/health

# Database connectivity
curl http://localhost:3001/api/queue/health
```

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors**

```bash
# Check PostgreSQL service
sc query postgresql-x64-17  # Windows
systemctl status postgresql # Linux

# Test connection
psql -U postgres -h localhost -d medp_queue
```

**Port Already in Use**

```bash
# Find process using port 3001
netstat -ano | findstr :3001  # Windows
lsof -i :3001                 # Linux/Mac

# Kill process
taskkill /PID <PID> /F        # Windows
kill -9 <PID>                 # Linux/Mac
```

**WebSocket Connection Issues**

- Check firewall settings
- Verify correct client connection URL
- Enable WebSocket transport debugging

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm run dev

# Database query logging
DEBUG=db:query npm run dev

# WebSocket events logging
DEBUG=socket.io:* npm run dev
```

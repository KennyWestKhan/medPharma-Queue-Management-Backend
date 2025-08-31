const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// Swagger definition
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "MedPharma Queue Management API",
    version: "1.0.0",
    description: `
# Medp Queue Management System API

A comprehensive REST API for managing online consultation queues with real-time WebSocket communication.

## Features
- 🏥 **Patient Queue Management**: Join, track position, and manage consultation queues
- 👨‍⚕️ **Doctor Dashboard**: Complete queue management for healthcare providers  
- 📊 **Real-time Updates**: WebSocket integration for live queue status updates
- 📈 **Statistics & Analytics**: Queue performance metrics and insights
- 🔒 **Secure & Validated**: Input validation, rate limiting, and error handling

## Authentication
This API currently uses basic authentication. In production, implement proper JWT authentication.

## Rate Limiting
- **100 requests per 15 minutes** per IP address
- **Stricter limits** may apply to sensitive endpoints

## WebSocket Events
The API also supports real-time communication through WebSocket connections.
See the **WebSocket Events** section below for detailed event documentation.

## Error Handling
All endpoints return consistent error responses:
\`\`\`json
{
  "success": false,
  "error": "Error Type",
  "message": "Human readable error message",
  "details": ["Validation error details if applicable"]
}
\`\`\`

## Success Responses
All successful endpoints return:
\`\`\`json
{
  "success": true,
  "message": "Success message",
  "data": { /* Response data */ }
}
\`\`\`
    `,
    contact: {
      name: "MedPharma Development Team",
      email: "boamponsemken@gmail.com",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Development server",
    },
    {
      url: "https://api.medp.com",
      description: "Production server",
    },
  ],
  tags: [
    {
      name: "Health",
      description: "System health and monitoring endpoints",
    },
    {
      name: "Queue Management",
      description: "Patient queue operations and status tracking",
    },
    {
      name: "Doctors",
      description: "Doctor profiles, availability, and queue management",
    },
    {
      name: "Patients",
      description: "Patient information and queue status",
    },
    {
      name: "WebSocket Events",
      description: "Real-time communication events and schemas",
    },
  ],
  components: {
    schemas: {
      // Common schemas
      ApiResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            description: "Indicates if the request was successful",
          },
          message: {
            type: "string",
            description: "Human readable message",
          },
          data: {
            type: "object",
            description: "Response data (varies by endpoint)",
          },
        },
        required: ["success"],
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: false,
          },
          error: {
            type: "string",
            description: "Error type",
            example: "Validation Error",
          },
          message: {
            type: "string",
            description: "Error message",
            example: "Invalid request data",
          },
          details: {
            type: "array",
            items: {
              type: "string",
            },
            description: "Detailed validation errors",
          },
        },
        required: ["success", "error", "message"],
      },

      // Doctor schemas
      Doctor: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique doctor identifier",
            example: "doc1",
          },
          name: {
            type: "string",
            description: "Doctor full name",
            example: "Dr. Sarah Johnson",
          },
          specialization: {
            type: "string",
            description: "Medical specialization",
            example: "General Medicine",
          },
          isAvailable: {
            type: "boolean",
            description: "Current availability status",
            example: true,
          },
          averageConsultationTime: {
            type: "integer",
            description: "Average consultation duration in minutes",
            example: 15,
          },
          maxDailyPatients: {
            type: "integer",
            description: "Maximum patients per day",
            example: 50,
          },
          consultationFee: {
            type: "number",
            format: "float",
            description: "Consultation fee in USD",
            example: 50.0,
          },
          bio: {
            type: "string",
            description: "Doctor biography",
            example: "Experienced general practitioner...",
          },
          currentPatientCount: {
            type: "integer",
            description: "Current number of patients in queue",
            example: 3,
          },
          waitingPatientCount: {
            type: "integer",
            description: "Number of patients waiting",
            example: 2,
          },
          isAtCapacity: {
            type: "boolean",
            description: "Whether doctor has reached daily capacity",
            example: false,
          },
        },
        required: [
          "id",
          "name",
          "specialization",
          "isAvailable",
          "averageConsultationTime",
        ],
      },

      // Patient schemas
      Patient: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "Unique patient identifier",
            example: "123e4567-e89b-12d3-a456-426614174000",
          },
          name: {
            type: "string",
            description: "Patient full name",
            example: "John Doe",
          },
          doctorId: {
            type: "string",
            description: "Assigned doctor ID",
            example: "doc1",
          },
          status: {
            type: "string",
            enum: ["waiting", "next", "consulting", "completed"],
            description: "Current patient status",
            example: "waiting",
          },
          estimatedDuration: {
            type: "integer",
            description: "Estimated consultation duration in minutes",
            example: 15,
          },
          joinedAt: {
            type: "string",
            format: "date-time",
            description: "When patient joined the queue",
            example: "2024-01-15T10:30:00Z",
          },
          consultationStartedAt: {
            type: "string",
            format: "date-time",
            description: "When consultation started",
            example: "2024-01-15T10:45:00Z",
            nullable: true,
          },
          consultationEndedAt: {
            type: "string",
            format: "date-time",
            description: "When consultation ended",
            example: "2024-01-15T11:00:00Z",
            nullable: true,
          },
          waitingTime: {
            type: "integer",
            description: "Total waiting time in minutes",
            example: 12,
          },
        },
        required: ["id", "name", "doctorId", "status", "joinedAt"],
      },

      // Queue schemas
      QueueStatus: {
        type: "object",
        properties: {
          patientId: {
            type: "string",
            format: "uuid",
            description: "Patient identifier",
          },
          position: {
            type: "integer",
            description: "Current position in queue (0 if not waiting)",
            example: 2,
          },
          estimatedWaitTime: {
            type: "integer",
            description: "Estimated wait time in minutes",
            example: 20,
          },
          status: {
            type: "string",
            enum: ["waiting", "next", "consulting", "completed"],
            description: "Current patient status",
          },
        },
        required: ["patientId", "position", "estimatedWaitTime", "status"],
      },

      QueueStatistics: {
        type: "object",
        properties: {
          totalPatients: {
            type: "integer",
            description: "Total patients today",
            example: 8,
          },
          waitingPatients: {
            type: "integer",
            description: "Currently waiting patients",
            example: 3,
          },
          consultingPatients: {
            type: "integer",
            description: "Currently consulting patients",
            example: 1,
          },
          completedPatients: {
            type: "integer",
            description: "Completed consultations today",
            example: 4,
          },
          averageWaitTime: {
            type: "integer",
            description: "Average wait time in minutes",
            example: 18,
          },
        },
        required: [
          "totalPatients",
          "waitingPatients",
          "consultingPatients",
          "completedPatients",
          "averageWaitTime",
        ],
      },

      // Input schemas
      CreatePatientInput: {
        type: "object",
        properties: {
          name: {
            type: "string",
            minLength: 1,
            maxLength: 100,
            description: "Patient full name",
            example: "John Doe",
          },
          doctorId: {
            type: "string",
            description: "ID of the doctor to consult",
            example: "doc1",
          },
          estimatedDuration: {
            type: "integer",
            minimum: 5,
            maximum: 60,
            description: "Estimated consultation duration in minutes",
            example: 15,
          },
        },
        required: ["name", "doctorId"],
      },

      UpdatePatientStatusInput: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["waiting", "next", "consulting", "completed"],
            description: "New patient status",
            example: "consulting",
          },
          notes: {
            type: "string",
            maxLength: 500,
            description: "Optional status update notes",
            example: "Patient ready for consultation",
          },
        },
        required: ["status"],
      },

      UpdateDoctorAvailabilityInput: {
        type: "object",
        properties: {
          isAvailable: {
            type: "boolean",
            description: "Doctor availability status",
            example: true,
          },
        },
        required: ["isAvailable"],
      },

      // WebSocket event schemas
      WebSocketEvent: {
        type: "object",
        description: "Base WebSocket event structure",
        properties: {
          event: {
            type: "string",
            description: "Event name",
          },
          data: {
            type: "object",
            description: "Event payload (varies by event type)",
          },
          timestamp: {
            type: "string",
            format: "date-time",
            description: "Event timestamp",
          },
        },
        required: ["event", "data"],
      },

      JoinRoomEvent: {
        type: "object",
        properties: {
          patientId: {
            type: "string",
            format: "uuid",
            description: "Patient ID (for patient rooms)",
          },
          doctorId: {
            type: "string",
            description: "Doctor ID",
          },
        },
        required: ["doctorId"],
      },

      QueueUpdateEvent: {
        type: "object",
        properties: {
          patientId: {
            type: "string",
            format: "uuid",
            description: "Patient identifier",
          },
          position: {
            type: "integer",
            description: "New queue position",
          },
          estimatedWaitTime: {
            type: "integer",
            description: "Updated estimated wait time in minutes",
          },
        },
        required: ["patientId", "position", "estimatedWaitTime"],
      },
    },

    responses: {
      SuccessResponse: {
        description: "Successful operation",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ApiResponse",
            },
          },
        },
      },
      BadRequestError: {
        description: "Bad request - validation error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
            example: {
              success: false,
              error: "Validation Error",
              message: "Invalid request data",
              details: ["Name is required", "Doctor ID must be provided"],
            },
          },
        },
      },
      NotFoundError: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
            example: {
              success: false,
              error: "Not Found",
              message: "Patient with ID 123 not found",
            },
          },
        },
      },
      InternalServerError: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
            example: {
              success: false,
              error: "Internal Server Error",
              message: "Something went wrong",
            },
          },
        },
      },
      TooManyRequestsError: {
        description: "Rate limit exceeded",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
            example: {
              success: false,
              error: "Too Many Requests",
              message: "Rate limit exceeded. Try again later.",
            },
          },
        },
      },
    },

    parameters: {
      PatientIdParam: {
        name: "patientId",
        in: "path",
        required: true,
        description: "Patient unique identifier",
        schema: {
          type: "string",
          format: "uuid",
          example: "123e4567-e89b-12d3-a456-426614174000",
        },
      },
      DoctorIdParam: {
        name: "doctorId",
        in: "path",
        required: true,
        description: "Doctor unique identifier",
        schema: {
          type: "string",
          example: "doc1",
        },
      },
    },
  },
};

// Options for the swagger docs
const options = {
  definition: swaggerDefinition,
  apis: [
    "./routes/*.js", // Path to the API files
    "./docs/websocket-events.yaml", // WebSocket events documentation
  ],
};

// Initialize swagger-jsdoc
const specs = swaggerJsdoc(options);

// Custom CSS for Swagger UI
const customCss = `
  .swagger-ui .topbar { display: none; }
  .swagger-ui .info { margin: 50px 0; }
  .swagger-ui .info .title { color: #2563eb; }
  .swagger-ui .scheme-container { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
  .swagger-ui .opblock.opblock-post { border-color: #059669; }
  .swagger-ui .opblock.opblock-get { border-color: #2563eb; }
  .swagger-ui .opblock.opblock-patch { border-color: #f59e0b; }
  .swagger-ui .opblock.opblock-delete { border-color: #ef4444; }
  .swagger-ui .opblock-summary-method { border-radius: 6px; }
`;

const swaggerUiOptions = {
  customCss,
  customSiteTitle: "MedPharma Queue Management API",
  customfavIcon: "/favicon.ico",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: "none",
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
  },
};

module.exports = {
  specs,
  swaggerUi,
  swaggerUiOptions,
};

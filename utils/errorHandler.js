class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const ErrorTypes = {
  VALIDATION: { statusCode: 400, errorCode: "VALIDATION_ERROR" },
  NOT_FOUND: { statusCode: 404, errorCode: "NOT_FOUND" },
  BAD_REQUEST: { statusCode: 400, errorCode: "BAD_REQUEST" },
  UNAUTHORIZED: { statusCode: 401, errorCode: "UNAUTHORIZED" },
  FORBIDDEN: { statusCode: 403, errorCode: "FORBIDDEN" },
  CONFLICT: { statusCode: 409, errorCode: "CONFLICT" },
  INTERNAL_SERVER: { statusCode: 500, errorCode: "INTERNAL_SERVER_ERROR" },
};

const formatErrorResponse = (error, includeDetails = false) => {
  const response = {
    success: false,
    error: error.errorCode || "ERROR",
    message: error.message,
    timestamp: new Date().toISOString(),
  };

  if (includeDetails && process.env.NODE_ENV !== "production") {
    response.details = error.stack;
  }

  return response;
};

module.exports = {
  AppError,
  ErrorTypes,
  formatErrorResponse,
};

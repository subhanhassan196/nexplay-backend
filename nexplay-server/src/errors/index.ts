import { ApiError } from "@/utils/ApiError";
import { HttpStatus } from "@/constants/httpStatus";

/**
 * Named error classes for the common failure modes across every
 * module (auth, users, and the Phase 6+ placeholder modules). All
 * extend the existing `ApiError` (utils/ApiError.ts) so the global
 * error handler needs no changes — these are ergonomic constructors,
 * not a parallel error system.
 */

export class ValidationError extends ApiError {
  constructor(message = "Validation failed", details?: unknown) {
    super(HttpStatus.BAD_REQUEST, message, details);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = "Resource") {
    super(HttpStatus.NOT_FOUND, `${resource} not found`);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Authentication required") {
    super(HttpStatus.UNAUTHORIZED, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "You do not have permission to perform this action") {
    super(HttpStatus.FORBIDDEN, message);
  }
}

export class ConflictError extends ApiError {
  constructor(message = "Resource already exists") {
    super(HttpStatus.CONFLICT, message);
  }
}

export class LockedError extends ApiError {
  constructor(message = "Resource is locked") {
    super(HttpStatus.LOCKED, message);
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message = "Too many requests") {
    super(HttpStatus.TOO_MANY_REQUESTS, message);
  }
}

export class NotImplementedError extends ApiError {
  constructor(feature: string) {
    super(HttpStatus.NOT_IMPLEMENTED, `${feature} is not implemented yet — architecture reserved for a later phase.`);
  }
}

export class InternalServerError extends ApiError {
  constructor(message = "Internal server error") {
    super(HttpStatus.INTERNAL_SERVER_ERROR, message, undefined, false);
  }
}

export { ApiError };

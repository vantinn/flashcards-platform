import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Normalizes every thrown error (Nest HttpExceptions and anything
 * unexpected) into one JSON shape: { statusCode, message, error }. Anything
 * that isn't a deliberate HttpException is logged server-side (with a
 * stack trace) but never reaches the client beyond a generic message — so
 * unexpected failures are debuggable without leaking internals.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = isHttpException ? exception.getResponse() : null;
    const message =
      typeof body === 'string'
        ? body
        : ((body as { message?: string | string[] })?.message ?? 'Internal server error');

    if (!isHttpException) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${request.method} ${request.url} -> unhandled error`, stack);
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error: isHttpException ? exception.name : 'InternalServerError',
    });
  }
}

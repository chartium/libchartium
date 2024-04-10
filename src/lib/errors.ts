export class InternalError extends Error {
  constructor(message: string) {
    super(`Unexpected internal error: ${message}`);
  }
}

export class UnknownTraceHandleError extends InternalError {
  constructor(handle: number) {
    super(`Trace with handle ${handle} has no id!`);
  }
}

export class UnknownTraceIdError extends InternalError {
  constructor(id: string) {
    super(`Trace with id ${id} was not found!`);
  }
}

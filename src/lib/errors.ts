export class InternalError extends Error {
  constructor(message: string) {
    super(`Unexpected internal error: ${message}`);
  }
}

export class UnknownVariantHandleError extends InternalError {
  constructor(handle: number) {
    super(`Variant with handle ${handle} has no id!`);
  }
}

export class UnknownVariantIdError extends InternalError {
  constructor(id: string) {
    super(`Variant with id ${id} was not found!`);
  }
}

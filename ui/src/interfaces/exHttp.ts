class exHttp extends Error {
  public status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'exHttp';
    this.status = status;

    // Fix prototype chain for ES5/ES6
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface IntfExHttp {
  status: number;
  message: string;
  name: string;
}
export class exHttpInvalidParams extends exHttp {
  constructor(message: string) {super(400, message)}
}
export class exHttpUnauthorized extends exHttp {
  constructor(message: string) {super(401, message)}
}
export class exHttpPaymentRequired extends exHttp {
  constructor(message: string) {super(402, message)}
}
export class exHttpAccessDenied extends exHttp {
  constructor(message: string) {super(403, message)}
}

export class exHttpNotAllowed extends exHttp {
  constructor(message: string) {super(405, message)}
}
export class exHttpNotAcceptable extends exHttp {
  constructor(message: string) {super(406, message)}
}

export class exHttpTimedOut extends exHttp {
  constructor(message: string) {super(408, message)}
}

export class exHttpConflict extends exHttp {
  constructor(message: string) {super(409, message)}
}

export class exHttpPreconditionFailed extends exHttp {
  constructor(message: string) {super(412, message)}
}

export class exHttpPayloadTooLarge extends exHttp {
  constructor(message: string) {super(413, message)}
}
export class exHttpInternalServerError extends exHttp {
  constructor(message: string) {super(500, message)}
}

export class exHttpNotImplemented extends exHttp {
  constructor(message: string) {super(501, message)}
}


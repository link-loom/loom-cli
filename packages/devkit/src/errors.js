export const EXIT_CODES = Object.freeze({
  ok: 0,
  failure: 1,
  usage: 2,
  precondition: 3,
  qualityGate: 4,
  interrupted: 130,
});

export const ERROR_CODES = Object.freeze({
  usage: { code: 'E_USAGE', exitCode: EXIT_CODES.usage },
  validation: { code: 'E_VALIDATION', exitCode: EXIT_CODES.usage },
  unknownCommand: { code: 'E_UNKNOWN_COMMAND', exitCode: EXIT_CODES.usage },
  targetExists: { code: 'E_TARGET_EXISTS', exitCode: EXIT_CODES.precondition },
  editShape: { code: 'E_EDIT_SHAPE', exitCode: EXIT_CODES.precondition },
  confirmationRequired: { code: 'E_CONFIRMATION_REQUIRED', exitCode: EXIT_CODES.precondition },
  notAvailable: { code: 'E_NOT_AVAILABLE', exitCode: EXIT_CODES.precondition },
  templateDrift: { code: 'E_TEMPLATE_DRIFT', exitCode: EXIT_CODES.precondition },
  io: { code: 'E_IO', exitCode: EXIT_CODES.failure },
  fetch: { code: 'E_FETCH', exitCode: EXIT_CODES.failure },
  install: { code: 'E_INSTALL', exitCode: EXIT_CODES.failure },
  checkFailed: { code: 'E_CHECK_FAILED', exitCode: EXIT_CODES.qualityGate },
});

export class LoomError extends Error {
  constructor(kind, message, details = {}) {
    super(message);
    this.name = 'LoomError';
    this.code = kind.code;
    this.exitCode = kind.exitCode;
    this.details = details;
  }

  toJSON() {
    return { code: this.code, message: this.message, ...this.details };
  }
}

export const isLoomError = (error) => error instanceof LoomError;

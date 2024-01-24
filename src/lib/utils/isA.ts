/* eslint-disable @typescript-eslint/ban-types */
export type nullish = undefined | null;
export type AnyConstructor = new (...x: any) => any;

export function isA(x: unknown, type: "string"): x is string;
export function isA(x: unknown, type: "number"): x is number;
export function isA(x: unknown, type: "bigint"): x is bigint;
export function isA(x: unknown, type: "boolean"): x is boolean;
export function isA(x: unknown, type: "symbol"): x is symbol;
export function isA(x: unknown, type: "undefined"): x is undefined;
export function isA(x: unknown, type: "object"): x is object | null;
export function isA(x: unknown, type: "function"): x is Function;

export function isA(x: unknown, type: "null"): x is null;
export function isA(x: unknown, type: "nullish"): x is nullish;
export function isA(x: unknown, type: "object!"): x is object;

export function isA(x: unknown, type: "string?"): x is string | nullish;
export function isA(x: unknown, type: "number?"): x is number | nullish;
export function isA(x: unknown, type: "bigint?"): x is bigint | nullish;
export function isA(x: unknown, type: "boolean?"): x is boolean | nullish;
export function isA(x: unknown, type: "symbol?"): x is symbol | nullish;
export function isA(x: unknown, type: "object?"): x is object | nullish;
export function isA(x: unknown, type: "function?"): x is Function | nullish;

export function isA(x: unknown, type: "array"): x is any[];
export function isA(x: unknown, type: "array?"): x is any[] | nullish;

export function isA<C extends AnyConstructor>(
  x: unknown,
  type: C,
): x is InstanceType<C>;

export function isA(x: unknown, type: string | AnyConstructor): boolean {
  switch (type) {
    case "string":
    case "number":
    case "bigint":
    case "boolean":
    case "symbol":
    case "undefined":
    case "object":
    case "function":
      return typeof x === type;

    case "null":
      return x === null;

    case "nullish":
      return x === null || x === undefined;

    case "object!":
      return typeof x === "object" && x !== null;

    case "string?":
    case "number?":
    case "bigint?":
    case "boolean?":
    case "symbol?":
    case "undefined?":
    case "object?":
    case "function?":
      return (
        x === undefined || x === null || typeof x === type.replace("?", "")
      );

    case "array":
      return Array.isArray(x);

    case "array?":
      return x === undefined || x === null || Array.isArray(x);

    default:
      if (typeof type === "string") {
        throw new TypeError(`Checking for unknown type: ${type}`);
      }
      return x instanceof type;
  }
}

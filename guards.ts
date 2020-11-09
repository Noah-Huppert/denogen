export function isNumber(v: unknown): v is number {
  return typeof (v) === "number";
}

export function isBoolean(v: unknown): v is boolean {
    return typeof(v) === 'boolean';
}

export function isString(v: unknown): v is string {
    return typeof(v) === 'string';
}

export function isStringMatch(v: string, w: string) {
    isString(v);
    isString(w);
    return v === w;
}
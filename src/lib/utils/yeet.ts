/* eslint-disable @typescript-eslint/no-explicit-any */
export const yeet: {
  (message: string): never;
  <T extends any[]>(error: { new (...args: T): any }, ...args: T): never;
} = (a: any, ...b: any[]): never => {
  if (typeof a === "string") throw new Error(a);
  else throw new a(...b);
};

export const todo = () => yeet("Not Implemented Yet");

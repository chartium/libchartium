export const yeet: {
  (message: string): never;
  (error: { new (message: string): any }, message: string): never;
} = (a: any, b?: any): never => {
  if (typeof a === "string") throw new Error(a);
  else throw new a(b);
};

export const todo = () => yeet("Not Implemented Yet");

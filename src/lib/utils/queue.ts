export class Queue<T> {
  private queue: T[] = [];

  get length() {
    return this.queue.length;
  }

  enqueue(item: T) {
    this.queue.push(item);
  }

  peek() {
    if (this.length === 0) {
      return undefined;
    }
    return this.queue[0];
  }

  peekAll() {
    return this.queue.slice();
  }

  dequeue() {
    return this.queue.shift();
  }
}

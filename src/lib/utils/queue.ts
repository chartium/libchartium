export class Queue<T> {
  private queue: T[] = [];

  get length() {
    return this.queue.length;
  }

  enqueue(item: T) {
    this.queue.push(item);
  }

  peek() {
    return this.queue[0];
  }

  dequeue() {
    return this.queue.shift();
  }
}

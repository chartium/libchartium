
// function that removes your callback (Subscriber) from the array of subscribers
export type Unsubscriber = () => void;

// function that is called on change of the value
export type Subscriber<T> = (value: T) => void;

export interface ReadableSignal<T> {
    subscribe(callback: (value: T) => void): Unsubscriber;
    get(): T;
}

export interface WritableSignal<T> extends ReadableSignal<T> {
    set(value: T): void;
    toReadable(): ReadableSignal<T>;
}

export function createWritableSignal<T>(defaultValue: T): WritableSignal<T> {
    let value = defaultValue;
    const subscribers = new Set<Subscriber<T>>;

    function subscribe(callback: (value: T) => void) {
        subscribers.add(callback)
        callback(value)

        return () => subscribers.delete(callback);
    }

    function set(newVal: T) {
        value = newVal;
        for (const scriber of subscribers) {
            scriber(newVal);
        }
    }

    function get() {
        return value;
    }

    function toReadable() {
        return {
            subscribe,
            get
        }
    }

    return {
        subscribe,
        set,
        get,
        toReadable
    }
}

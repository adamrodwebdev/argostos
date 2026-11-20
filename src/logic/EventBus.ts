type Listener = (event: never) => void;

/**
 * Typed events between the layers: the logic publishes what happened (a breach, a truck caught),
 * the design listens and reacts (dust, a flash, a shake). Created by the composition root and
 * handed to both, never a global.
 */
export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, Listener[]>();

  /** Listens to one kind of event; returns the function that stops listening. */
  on<K extends keyof Events>(name: K, listener: (event: Events[K]) => void): () => void {
    const list = this.listeners.get(name) ?? [];
    const entry = listener as Listener;
    list.push(entry);
    this.listeners.set(name, list);
    return () => {
      const index = list.indexOf(entry);
      if (index >= 0) list.splice(index, 1);
    };
  }

  emit<K extends keyof Events>(name: K, event: Events[K]): void {
    const list = this.listeners.get(name);
    if (!list) return;
    for (const listener of list) (listener as (event: Events[K]) => void)(event);
  }
}

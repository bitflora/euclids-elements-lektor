// Hovering a lettered name anywhere — in Euclid's text or in a note — lights
// that object in whichever diagram is on screen.
type Listener = (name: string | null) => void;
const listeners = new Set<Listener>();

export const diagramBus = {
  hover(name: string | null) {
    listeners.forEach((l) => l(name));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};

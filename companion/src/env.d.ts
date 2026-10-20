/// <reference types="vite/client" />
declare module "virtual:joyce" {
  import type { JoyceEntry } from "./types";
  const entries: Record<string, JoyceEntry>;
  export default entries;
}
interface Window {
  geomlib?: any;
}

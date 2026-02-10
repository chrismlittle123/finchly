import { nanoid } from "nanoid";

export function createId(prefix: string): string {
  return `${prefix}_${nanoid(21)}`;
}

export function linkId(): string {
  return createId("lnk");
}

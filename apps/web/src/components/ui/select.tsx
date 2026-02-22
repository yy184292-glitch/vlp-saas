import * as React from "react";

type AnyProps = Record<string, unknown> & { children?: React.ReactNode };

export function Select(props: AnyProps) {
  return <div {...props} />;
}
export function SelectTrigger(props: AnyProps) {
  return <div {...props} />;
}
export function SelectValue(props: AnyProps) {
  return <span {...props} />;
}
export function SelectContent(props: AnyProps) {
  return <div {...props} />;
}
export function SelectItem(props: AnyProps) {
  return <div {...props} />;
}
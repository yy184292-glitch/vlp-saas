import * as React from "react";

type AnyProps = Record<string, unknown> & { children?: React.ReactNode };

export function Dialog(props: AnyProps) {
  return <>{props.children}</>;
}
export function DialogTrigger(props: AnyProps) {
  return <>{props.children}</>;
}
export function DialogContent(props: AnyProps) {
  return <div {...props} />;
}
export function DialogHeader(props: AnyProps) {
  return <div {...props} />;
}
export function DialogTitle(props: AnyProps) {
  return <div {...props} />;
}
export function DialogFooter(props: AnyProps) {
  return <div {...props} />;
}
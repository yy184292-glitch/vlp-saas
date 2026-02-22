import * as React from "react";

type AnyProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: string;
};

export function Badge({ variant, ...props }: AnyProps) {
  return <span {...props} />;
}
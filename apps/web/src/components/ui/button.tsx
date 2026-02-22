import * as React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "secondary" | (string & {});
  size?: string;
};

export function Button(props: ButtonProps) {
  return <button {...props} />;
}
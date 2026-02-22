import * as React from "react";

type AnyProps<T> = React.HTMLAttributes<T> & Record<string, unknown>;

export function Table(props: AnyProps<HTMLTableElement>) { return <table {...props} />; }
export function TableHeader(props: AnyProps<HTMLTableSectionElement>) { return <thead {...props} />; }
export function TableBody(props: AnyProps<HTMLTableSectionElement>) { return <tbody {...props} />; }
export function TableRow(props: AnyProps<HTMLTableRowElement>) { return <tr {...props} />; }
export function TableHead(props: AnyProps<HTMLTableCellElement>) { return <th {...props} />; }
export function TableCell(props: React.TdHTMLAttributes<HTMLTableCellElement> & Record<string, unknown>) {
  return <td {...props} />;
}
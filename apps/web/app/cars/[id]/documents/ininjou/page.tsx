import PrintClient from "./PrintClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <PrintClient params={ { id } } />;
}

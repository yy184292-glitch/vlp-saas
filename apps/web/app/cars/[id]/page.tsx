import CarDetailClient from "./CarDetailClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <CarDetailClient carId={id} />;
}

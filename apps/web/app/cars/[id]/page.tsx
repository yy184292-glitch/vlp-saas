import CarDetailClient from "./CarDetailClient";

type PageProps = {
  params: {
    id: string;
  };
};

export default function Page({ params }: PageProps) {
  return <CarDetailClient carId={params.id} />;
}

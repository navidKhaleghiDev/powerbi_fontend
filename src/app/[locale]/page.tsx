import { redirect } from "next/navigation";
interface Props {
  params: Promise<{ locale: string }>;
}
const Page = async ({ params }: Props) => {
  const { locale } = await params;
  redirect(`/${locale}/data-platform`);
};
export default Page;

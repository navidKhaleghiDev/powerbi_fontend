import { AnalyticsPanel } from "@/components/workspace/AnalyticsPanel";
interface Props {
  searchParams: Promise<{ report?: string }>;
}
const Page = async ({ searchParams }: Props) => (
  <AnalyticsPanel initialReportId={(await searchParams).report} />
);
export default Page;

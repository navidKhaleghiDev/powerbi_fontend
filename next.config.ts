import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const config: NextConfig = { poweredByHeader: false };
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
export default withNextIntl(config);

import { getRequestConfig } from "next-intl/server";
import fa from "../../public/locales/fa.json";

export default getRequestConfig(async () => ({
  locale: "fa",
  messages: fa,
  timeZone: "Asia/Tehran",
}));

import localFont from "next/font/local";

export const kalameh = localFont({
  src: [
    {
      path: "./fonts/KalamehWebFaNum-Regular.woff2",
      weight: "200",
      style: "normal",
    },
    {
      path: "./fonts/KalamehWebFaNum-Medium.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/KalamehWebFaNum-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/KalamehWebFaNum-Bold.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/KalamehWebFaNum-ExtraBold.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-kalameh",
});

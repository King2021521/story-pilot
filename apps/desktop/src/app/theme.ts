import type { ThemeConfig } from "antd";

export const storyPilotTheme: ThemeConfig = {
  token: {
    borderRadius: 8,
    colorBgContainer: "#ffffff",
    colorBgLayout: "#f7f7f5",
    colorBorder: "#e7e5e4",
    colorInfo: "#2563eb",
    colorPrimary: "#111827",
    colorSuccess: "#16a34a",
    colorText: "#1f2937",
    colorTextSecondary: "#6b7280",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  components: {
    Button: {
      controlHeight: 36,
      primaryShadow: "none",
    },
    Card: {
      borderRadiusLG: 8,
    },
    Layout: {
      bodyBg: "#f7f7f5",
      headerBg: "#ffffff",
      siderBg: "#fbfbfa",
    },
  },
};

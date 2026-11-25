import type { ThemeId } from "../types";

export interface ThemeProfile {
  id: ThemeId;
  label: string;
  isDarkMap: boolean;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  heatGradient: Record<number, string>;
  colorStops: [number, string][];
  labelTextColor: string;
  markerStroke: string;
  chartGrid: string;
  chartBar1: string;
  chartBar2: string;
  chartBar3: string;
  palette: string[];
}

export const THEME_PROFILES: Record<ThemeId, ThemeProfile> = {
  dark: {
    id: "dark",
    label: "Obsidian Dark",
    isDarkMap: true,
    bg: "#09090B",
    surface: "#121216",
    text: "#FAFAFA",
    muted: "#9A9AA6",
    accent: "#FF3366",
    accent2: "#FF6B4A",
    heatGradient: { 0.15: "#4C1D95", 0.45: "#FF3366", 0.78: "#FF6B4A", 1.0: "#FFE4C4" },
    colorStops: [[0.0, "#6D28D9"], [0.45, "#FF3366"], [0.78, "#FF6B4A"], [1.0, "#FBBF24"]],
    labelTextColor: "#FFFFFF",
    markerStroke: "#09090B",
    chartGrid: "rgba(255,255,255,0.06)",
    chartBar1: "#FF3366",
    chartBar2: "#FF6B4A",
    chartBar3: "#A855F7",
    palette: ["#FF3366", "#FF6B4A", "#FBBF24", "#A855F7", "#2DD4BF", "#38BDF8", "#FB7185", "#818CF8"]
  },
  light: {
    id: "light",
    label: "BitterSweet Cream",
    isDarkMap: false,
    bg: "#FAF7F2",
    surface: "#FFFFFF",
    text: "#141218",
    muted: "#686370",
    accent: "#D93855",
    accent2: "#E66235",
    heatGradient: { 0.15: "#7C3AED", 0.45: "#D93855", 0.78: "#E66235", 1.0: "#F59E0B" },
    colorStops: [[0.0, "#7C3AED"], [0.45, "#D93855"], [0.78, "#E66235"], [1.0, "#F59E0B"]],
    labelTextColor: "#FFFFFF",
    markerStroke: "#FFFFFF",
    chartGrid: "rgba(20,18,24,0.07)",
    chartBar1: "#D93855",
    chartBar2: "#E66235",
    chartBar3: "#7C3AED",
    palette: ["#D93855", "#E66235", "#D97706", "#7C3AED", "#0D9488", "#0284C7", "#DB2777", "#4F46E5"]
  },
  volcano: {
    id: "volcano",
    label: "Volcano Black",
    isDarkMap: false,
    bg: "#F6F6F7",
    surface: "#FFFFFF",
    text: "#0F0F12",
    muted: "#5C5C66",
    accent: "#111114",
    accent2: "#3A3A42",
    heatGradient: { 0.15: "#A1A1AA", 0.45: "#52525B", 0.78: "#27272A", 1.0: "#09090B" },
    colorStops: [[0.0, "#A1A1AA"], [0.45, "#52525B"], [0.78, "#27272A"], [1.0, "#09090B"]],
    labelTextColor: "#FFFFFF",
    markerStroke: "#FFFFFF",
    chartGrid: "rgba(15,15,18,0.08)",
    chartBar1: "#111114",
    chartBar2: "#3F3F46",
    chartBar3: "#71717A",
    palette: ["#111114", "#27272A", "#3F3F46", "#52525B", "#71717A", "#A1A1AA", "#D4D4D8", "#18181B"]
  },
  nasa: {
    id: "nasa",
    label: "NASA Space Grey",
    isDarkMap: true,
    bg: "#0B0D11",
    surface: "#12151C",
    text: "#ECEFF4",
    muted: "#8E98A8",
    accent: "#E2E8F0",
    accent2: "#94A3B8",
    heatGradient: { 0.15: "#334155", 0.45: "#64748B", 0.78: "#CBD5E1", 1.0: "#F8FAFC" },
    colorStops: [[0.0, "#475569"], [0.45, "#94A3B8"], [0.78, "#CBD5E1"], [1.0, "#F8FAFC"]],
    labelTextColor: "#0B0D11",
    markerStroke: "#0B0D11",
    chartGrid: "rgba(226,232,240,0.08)",
    chartBar1: "#E2E8F0",
    chartBar2: "#94A3B8",
    chartBar3: "#64748B",
    palette: ["#F1F5F9", "#CBD5E1", "#94A3B8", "#64748B", "#475569", "#334155", "#E2E8F0", "#1E293B"]
  }
};

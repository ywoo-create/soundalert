import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages의 프로젝트 경로에서도 정적 자산을 올바르게 찾도록 상대 경로 사용
  base: "./",
});

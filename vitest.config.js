import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,jsx}', 'tests/**/*.{test,spec}.{js,jsx}'],
  },
})

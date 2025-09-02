import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true, // Nonaktifkan optimisasi gambar global
    domains: [],
    disableStaticImages: true // Memaksa penggunaan import untuk gambar statis
  }
};

// module.exports = {
// }

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn2.cdnstep.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.cdnstep.com',
      },
      {
        protocol: 'https',
        hostname: 'imgcdn.sigstick.com',
      },
    ],
    unoptimized: true,
  },
};

export default nextConfig;

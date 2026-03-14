import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@checkers/shared'],
  async rewrites() {
    return [
      // Exact match for Tendermint JSON-RPC (POST to root)
      {
        source: '/chain-rpc',
        destination: 'http://49.13.3.227:26657/',
      },
      {
        source: '/chain-rpc/:path*',
        destination: 'http://49.13.3.227:26657/:path*',
      },
      {
        source: '/chain-rest/:path*',
        destination: 'http://49.13.3.227:1317/:path*',
      },
    ]
  },
}

export default nextConfig

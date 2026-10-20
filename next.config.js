/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  // The comparison page was first published as /similar-teams.
  async redirects() {
    return [{ source: '/similar-teams', destination: '/team-comparison', permanent: false }]
  },
}
module.exports = nextConfig

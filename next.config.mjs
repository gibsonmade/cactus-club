/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === "true";
const repoBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "/cactus-club";

const nextConfig = {
  output: isGithubPages ? "export" : undefined,
  basePath: isGithubPages ? repoBasePath : undefined,
  assetPrefix: isGithubPages ? `${repoBasePath}/` : undefined,
  images: {
    unoptimized: isGithubPages,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets0.dostuffmedia.com"
      },
      {
        protocol: "https",
        hostname: "cloudinary-assets.dostuffmedia.com"
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org"
      }
    ]
  }
};

export default nextConfig;

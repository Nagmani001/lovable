ARG NODE_VERSION=24.13.1
FROM node:${NODE_VERSION}-slim

WORKDIR /build

# tar is needed by the entrypoint (extract incoming tarball, archive dist back).
RUN apt-get update \
  && apt-get install -y --no-install-recommends tar \
  && rm -rf /var/lib/apt/lists/*

# The worker streams the project tarball on stdin and receives the built dist
# tarball on stdout. This throwaway container runs npm install / build so
# untrusted scripts never execute on the host, and it never receives object
# store or Cloudflare credentials.
COPY entrypoint.sh /usr/local/bin/lovable-build
RUN chmod +x /usr/local/bin/lovable-build

ENTRYPOINT ["/usr/local/bin/lovable-build"]
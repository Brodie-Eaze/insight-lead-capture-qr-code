# Insight lead capture. No dependencies, so the image is just Node and the files.
FROM node:20-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY public ./public
ENV NODE_ENV=production PORT=8093 DATA_DIR=/data
# Leads are written to /data/leads.jsonl. Mount a volume at /data (docker run -v ...:/data) so they survive restarts.
RUN mkdir -p /data && chown node:node /data
EXPOSE 8093
USER node
HEALTHCHECK CMD wget -qO- http://localhost:8093/health || exit 1
CMD ["node", "server.mjs"]

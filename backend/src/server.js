const http = require("http");
const app = require("./app");
const env = require("./config/env");
const connectDatabase = require("./config/db");
const { initializeSocket } = require("./config/socket");

const startServer = async () => {
  await connectDatabase();

  const server = http.createServer(app);
  initializeSocket(server);

  server.listen(env.PORT, env.HOST, () => {
    const hostLabel = env.HOST === "0.0.0.0" ? "all network interfaces" : env.HOST;

    // eslint-disable-next-line no-console
    console.log(`Backend listening on ${hostLabel}:${env.PORT}`);
  });
};

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", error);
  process.exit(1);
});

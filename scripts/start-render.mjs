process.env.HOSTNAME="0.0.0.0";
process.env.PORT||="10000";
await import("../.next/standalone/server.js");

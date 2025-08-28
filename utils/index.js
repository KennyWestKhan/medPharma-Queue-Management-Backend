// Initialize database and start server
export async function startServer() {
  try {
    await databaseService.initialize();
    console.log("Database connected and initialized");

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Socket.io ready for connections`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

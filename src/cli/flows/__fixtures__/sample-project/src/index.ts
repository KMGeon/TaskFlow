import express from "express";

const app = express();

// 사용자 API
app.get("/api/users", (req, res) => {
  res.json({ users: [] });
});

app.post("/api/users", (req, res) => {
  res.json({ created: true });
});

export default app;

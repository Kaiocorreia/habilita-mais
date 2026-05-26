import express from "express";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import professionalRoutes from "./routes/professionals.js";
import appointmentRoutes from "./routes/appointments.js";
import reviewRoutes from "./routes/reviews.js";
import { authenticate } from "./middlewares/authenticate.js";

export function createApp() {
  const app = express();
  app.use(express.json());

  // Rotas públicas (não exigem token)
  app.use("/auth", authRoutes);

  // Todas as rotas abaixo exigem token válido
  app.use(authenticate);

  app.use("/users", userRoutes);
  app.use("/professionals", professionalRoutes);
  app.use("/appointments", appointmentRoutes);
  app.use("/reviews", reviewRoutes);

  // Handler global de erros
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error(err.message);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  );

  return app;
}

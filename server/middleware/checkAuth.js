// middlewares/auth.js
import jwt from "jsonwebtoken";

export const authenticateToken = (req, res, next) => {
  // نقرأ التوكن من الكوكي
  const token = req.cookies?.token;

  if (!token) {
    console.log("No token provided → Access denied");
    return res.status(401).json({ message: "Access denied" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log("Token verification failed:", err.message);
      return res.status(403).json({ message: "Invalid token" });
    }

    console.log("Token verified successfully:", user);
    req.user = user; // id + role
    next();
  });
};
// middlewares/authorize.js
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    console.log("User from req.user:", req.user);
    console.log("Allowed roles for this route:", allowedRoles);

    if (!req.user || !req.user.role) {
      console.log("User role missing → Access forbidden");
      return res.status(403).json({ message: "Access forbidden" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.log(`User role ${req.user.role} not allowed → Access denied`);
      return res.status(403).json({ message: "You don't have permission" });
    }

    console.log("User authorized → Proceeding to next");
    next(); // user عنده صلاحية → كيدوز
  };
};
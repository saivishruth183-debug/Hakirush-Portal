// Role gate. Use after authMiddleware: router.post("/x", authMiddleware, authorizeRoles("admin"), handler)
// Note: a department manager assignment is NOT a role; managers remain "employee".
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
        code: "FORBIDDEN",
      });
    }
    next();
  };
};

export const requireAdmin = authorizeRoles("admin");
export const requireEmployee = authorizeRoles("employee");
export const requireClient = authorizeRoles("client");

export default authorizeRoles;

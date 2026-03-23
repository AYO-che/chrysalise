// controllers/sessionController.js
import prisma from "../prismaClient.js";

const userSelect = {
  select: { id: true, firstName: true, lastName: true, email: true, image: true },
};

// =====================
// 1️⃣ Get all sessions (ADMIN)
// =====================
export const getAllSessions = async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        subscription: { select: { offer: true } },
        patient: userSelect,
        nutrition: userSelect,
      },
      orderBy: { sessionDate: "asc" },
    });

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 2️⃣ Get my sessions (CLIENT or NUTRITION)
// =====================
export const getMySessions = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    const whereCondition =
      role === "CLIENT" ? { patientId: userId } : { nutritionId: userId };

    const sessions = await prisma.session.findMany({
      where: whereCondition,
      include: {
        subscription: { select: { offer: true } },
        patient: userSelect,
        nutrition: userSelect,
      },
      orderBy: { sessionDate: "asc" },
    });

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 3️⃣ Get session by ID
// =====================
export const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId, role } = req.user;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        subscription: { select: { offer: true } },
        patient: userSelect,
        nutrition: userSelect,
        reviews: true,
      },
    });

    if (!session) return res.status(404).json({ message: "Session not found" });

    if (
      role !== "ADMIN" &&
      session.patientId !== userId &&
      session.nutritionId !== userId
    )
      return res.status(403).json({ message: "Access forbidden" });

    res.json({ session });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 4️⃣ Update session status (NUTRITION or ADMIN)
// =====================
export const updateSessionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { id: userId, role } = req.user;

    if (!["SCHEDULED", "COMPLETED", "CANCELLED"].includes(status))
      return res.status(400).json({ message: "Invalid status value" });

    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (role !== "ADMIN" && session.nutritionId !== userId)
      return res.status(403).json({ message: "Access forbidden" });

    const updated = await prisma.session.update({
      where: { id },
      data: { status },
    });

    res.json({ session: updated });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
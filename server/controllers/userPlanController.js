// controllers/userPlanController.js
import prisma from "../prismaClient.js";

// =====================
// 1️⃣ Get all UserPlans for logged-in client
// =====================
export const getMyUserPlans = async (req, res) => {
  try {
    const userId = req.user.id;

    const userPlans = await prisma.userPlan.findMany({
      where: { userId },
      include: {
        plan: { include: { offer: true } },
        dailyTracking: true,
      },
      orderBy: { startDate: "desc" },
    });

    res.json({ userPlans });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 2️⃣ Get single UserPlan by ID
// =====================
export const getUserPlanById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const userPlan = await prisma.userPlan.findUnique({
      where: { id },
      include: {
        plan: { include: { offer: true } },
        dailyTracking: { orderBy: { date: "asc" } },
      },
    });

    if (!userPlan)
      return res.status(404).json({ message: "User plan not found" });

    if (userPlan.userId !== userId)
      return res.status(403).json({ message: "Access forbidden" });

    res.json({ userPlan });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 3️⃣ Get current day plan for logged-in client
// =====================
export const getMyCurrentPlanDay = async (req, res) => {
  try {
    const userId = req.user.id;

    const userPlan = await prisma.userPlan.findFirst({
      where: {
        userId,
        subscription: { status: "ACTIVE" },
      },
      include: {
        plan: true,
        subscription: { include: { offer: true } },
      },
      orderBy: { startDate: "desc" },
    });

    if (!userPlan)
      return res.status(404).json({ message: "No active plan found" });

    const plan = userPlan.plan;
    const days = plan.content?.days;

    if (!days || !Array.isArray(days) || days.length === 0)
      return res.status(400).json({ message: "Plan has no days content" });

    const diffTime = new Date() - new Date(userPlan.startDate);
    const dayNumber = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const totalDays = days.length;
    const currentDayIndex = (dayNumber - 1) % totalDays;
    const todayPlan = days[currentDayIndex];

    res.json({
      day: currentDayIndex + 1,
      totalDays,
      todayPlan,
      planTitle: plan.title,
      progress: userPlan.progress,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 4️⃣ Create or update daily tracking
// =====================
export const createOrUpdateDailyTracking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userPlanId } = req.params;
    const {
      date,
      mealsDoneIds,
      mealsMissedIds,
      habitsDoneIds,
      habitsMissedIds,
      calories,
    } = req.body;

    if (!date)
      return res.status(400).json({ message: "date is required" });

    const userPlan = await prisma.userPlan.findUnique({ where: { id: userPlanId } });
    if (!userPlan)
      return res.status(404).json({ message: "User plan not found" });

    if (userPlan.userId !== userId)
      return res.status(403).json({ message: "Access forbidden" });

    const done = mealsDoneIds?.length ?? 0;
    const missed = mealsMissedIds?.length ?? 0;
    const habitsDone = habitsDoneIds?.length ?? 0;
    const habitsMissed = habitsMissedIds?.length ?? 0;
    const totalTasks = done + missed + habitsDone + habitsMissed;
    const completedTasks = done + habitsDone;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const dayTracking = await prisma.dailyTracking.upsert({
      where: {
        userPlanId_date: {
          userPlanId,
          date: new Date(date),
        },
      },
      update: {
        mealsDoneIds: mealsDoneIds ?? [],
        mealsMissedIds: mealsMissedIds ?? [],
        habitsDoneIds: habitsDoneIds ?? [],
        habitsMissedIds: habitsMissedIds ?? [],
        calories: calories ?? null,
      },
      create: {
        userPlanId,
        date: new Date(date),
        mealsDoneIds: mealsDoneIds ?? [],
        mealsMissedIds: mealsMissedIds ?? [],
        habitsDoneIds: habitsDoneIds ?? [],
        habitsMissedIds: habitsMissedIds ?? [],
        calories: calories ?? null,
      },
    });

    const updatedPlan = await prisma.userPlan.update({
      where: { id: userPlanId },
      data: { progress },
    });

    res.json({ dayTracking, updatedPlan });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 5️⃣ Get all daily tracking for a user plan
// =====================
export const getDailyTracking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userPlanId } = req.params;

    const userPlan = await prisma.userPlan.findUnique({ where: { id: userPlanId } });
    if (!userPlan)
      return res.status(404).json({ message: "User plan not found" });

    if (userPlan.userId !== userId)
      return res.status(403).json({ message: "Access forbidden" });

    const dailyTracking = await prisma.dailyTracking.findMany({
      where: { userPlanId },
      orderBy: { date: "asc" },
    });

    res.json({ dailyTracking });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 6️⃣ Get daily tracking for a specific date
// =====================
export const getDailyTrackingByDate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { userPlanId, date } = req.params;

    const userPlan = await prisma.userPlan.findUnique({ where: { id: userPlanId } });
    if (!userPlan)
      return res.status(404).json({ message: "User plan not found" });

    if (userPlan.userId !== userId)
      return res.status(403).json({ message: "Access forbidden" });

    const dailyTracking = await prisma.dailyTracking.findUnique({
      where: {
        userPlanId_date: {
          userPlanId,
          date: new Date(date),
        },
      },
    });

    if (!dailyTracking)
      return res.status(404).json({ message: "No tracking found for this date" });

    res.json({ dailyTracking });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
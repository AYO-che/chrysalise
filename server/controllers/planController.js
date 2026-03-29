// controllers/planController.js
import prisma from "../prismaClient.js";

const nutritionSelect = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    image: true,
    resume: true,
  },
};

// =====================
// 1️⃣ Get all plans (CLIENT + ADMIN)
// =====================
export const getAllPlans = async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      include: {
        offer: true,
        nutrition: nutritionSelect,
      },
    });
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 2️⃣ Get single plan by ID
// =====================
export const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await prisma.plan.findUnique({
      where: { id },
      include: {
        offer: true,
        nutrition: nutritionSelect,
      },
    });

    if (!plan) return res.status(404).json({ message: "Plan not found" });

    res.json({ plan });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 3️⃣ Get my plans (NUTRITION)
// =====================
export const getMyPlans = async (req, res) => {
  try {
    const nutritionId = req.user.id;

    const plans = await prisma.plan.findMany({
      where: { nutritionId },
      include: { offer: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({ plans });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 4️⃣ Create a plan (NUTRITION)
// Offer + Plan created atomically in one transaction
// =====================
export const createPlan = async (req, res) => {
  try {
    const nutritionId = req.user.id;

    const {
      offerName,
      offerDescription,
      offerPrice,
      offerDurationDays,
      hasFreeTrial,
      includesSessions,
      title,
      content,
      images,
      videos,
      pdfUrl,
      goals,
      activityLevels,
      minWeight,
      maxWeight,
      minHeight,
      maxHeight,
      medicalConditions,
    } = req.body;

    if (!offerName || !offerPrice || !offerDurationDays || !title || !content)
      return res.status(400).json({
        message: "offerName, offerPrice, offerDurationDays, title and content are required",
      });

    if (!content.days || !Array.isArray(content.days) || content.days.length === 0)
      return res.status(400).json({ message: "Content must have a non-empty days array" });

    const result = await prisma.$transaction(async (tx) => {
      const offer = await tx.offer.create({
        data: {
          name: offerName,
          description: offerDescription ?? null,
          type: "PLAN",
          price: offerPrice,
          durationDays: offerDurationDays,
          hasFreeTrial: hasFreeTrial ?? false,
          includesSessions: includesSessions ?? false,
          isActive: true,
        },
      });

      const plan = await tx.plan.create({
        data: {
          offerId: offer.id,
          nutritionId,
          title,
          content,
          images: images ?? [],
          videos: videos ?? [],
          pdfUrl: pdfUrl ?? null,
          goals: goals ?? [],
          activityLevels: activityLevels ?? [],
          minWeight: minWeight ?? null,
          maxWeight: maxWeight ?? null,
          minHeight: minHeight ?? null,
          maxHeight: maxHeight ?? null,
          medicalConditions: medicalConditions ?? [],
        },
      });

      return { offer, plan };
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 5️⃣ Update a plan (NUTRITION — own plans only, or ADMIN)
// =====================
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const nutritionId = req.user.id;

    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Plan not found" });

    if (req.user.role !== "ADMIN" && existing.nutritionId !== nutritionId)
      return res.status(403).json({ message: "You can only update your own plans" });

    const {
      title,
      content,
      images,
      videos,
      pdfUrl,
      goals,
      activityLevels,
      minWeight,
      maxWeight,
      minHeight,
      maxHeight,
      medicalConditions,
      offerName,
      offerDescription,
      offerPrice,
      offerDurationDays,
      isActive,
    } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      if (
        offerName !== undefined ||
        offerDescription !== undefined ||
        offerPrice !== undefined ||
        offerDurationDays !== undefined ||
        isActive !== undefined
      ) {
        await tx.offer.update({
          where: { id: existing.offerId },
          data: {
            ...(offerName !== undefined && { name: offerName }),
            ...(offerDescription !== undefined && { description: offerDescription }),
            ...(offerPrice !== undefined && { price: offerPrice }),
            ...(offerDurationDays !== undefined && { durationDays: offerDurationDays }),
            ...(isActive !== undefined && { isActive }),
          },
        });
      }

      const plan = await tx.plan.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(content !== undefined && { content }),
          ...(images !== undefined && { images }),
          ...(videos !== undefined && { videos }),
          ...(pdfUrl !== undefined && { pdfUrl }),
          ...(goals !== undefined && { goals }),
          ...(activityLevels !== undefined && { activityLevels }),
          ...(minWeight !== undefined && { minWeight }),
          ...(maxWeight !== undefined && { maxWeight }),
          ...(minHeight !== undefined && { minHeight }),
          ...(maxHeight !== undefined && { maxHeight }),
          ...(medicalConditions !== undefined && { medicalConditions }),
        },
        include: { offer: true },
      });

      return plan;
    });

    res.json({ plan: result });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 6️⃣ Delete a plan (NUTRITION — own plans only, or ADMIN)
// Hard deletes the plan and deactivates the linked offer
// =====================
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const nutritionId = req.user.id;

    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Plan not found" });

    if (req.user.role !== "ADMIN" && existing.nutritionId !== nutritionId)
      return res.status(403).json({ message: "You can only delete your own plans" });

    const activeSubscriptions = await prisma.subscription.findFirst({
      where: { offerId: existing.offerId, status: { in: ["ACTIVE", "PENDING"] } },
    });
    if (activeSubscriptions)
      return res.status(400).json({
        message: "Cannot delete a plan with active or pending subscriptions",
      });

    await prisma.$transaction(async (tx) => {
      await tx.plan.delete({ where: { id } });
      await tx.offer.update({
        where: { id: existing.offerId },
        data: { isActive: false },
      });
    });

    res.json({ message: "Plan deleted and offer deactivated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// 7️⃣ Get recommended plans for logged-in client
// =====================
export const getRecommendedPlans = async (req, res) => {
  try {
    const userId = req.user.id;

    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile)
      return res.status(404).json({
        message: "Profile not found. Please complete your profile first.",
      });

    const recommendedPlans = await prisma.plan.findMany({
      where: {
        offer: { isActive: true },
        AND: [
          { goals: { has: profile.goal } },
          { activityLevels: { has: profile.activityLevel } },
          { OR: [{ minWeight: null }, { minWeight: { lte: profile.weight } }] },
          { OR: [{ maxWeight: null }, { maxWeight: { gte: profile.weight } }] },
          { OR: [{ minHeight: null }, { minHeight: { lte: profile.height } }] },
          { OR: [{ maxHeight: null }, { maxHeight: { gte: profile.height } }] },
          { NOT: { medicalConditions: { hasSome: profile.medicalConditions } } },
        ],
      },
      include: {
        offer: true,
        nutrition: nutritionSelect,
      },
    });

    res.json({ recommendedPlans });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
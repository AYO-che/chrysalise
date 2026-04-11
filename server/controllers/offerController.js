// controllers/offerController.js
import prisma from "../prismaClient.js";

// ==============================
// 1️⃣ Create Offer (NUTRITION only)
// ==============================
export const createOffer = async (req, res) => {
  try {
    const nutritionId = req.user.id;
    const {
      name,
      description,
      type,
      price,
      durationDays,
      hasFreeTrial,
      includesSessions,
    } = req.body;

    if (!name || !type || !price || !durationDays)
      return res.status(400).json({ message: "name, type, price and durationDays are required" });

    if (!["PLAN", "CONSULTATION", "AI_CALORIES"].includes(type))
      return res.status(400).json({ message: "Invalid offer type" });

    // CONSULTATION offer — check nutritionist has Stripe connected
    if (type === "CONSULTATION") {
      const stripe = await prisma.stripe.findUnique({ where: { userId: nutritionId } });
      if (!stripe)
        return res.status(400).json({ message: "You must connect Stripe before creating a consultation offer" });
    }

    const offer = await prisma.offer.create({
      data: {
        nutritionId,
        name,
        description: description ?? null,
        type,
        price,
        durationDays,
        hasFreeTrial: hasFreeTrial ?? false,
        includesSessions: type === "CONSULTATION" ? true : (includesSessions ?? false),
        isActive: true,
      },
    });

    // Update resume offersTypes
    await prisma.resume.update({
      where: { userId: nutritionId },
      data: {
        offersTypes: {
          push: type,
        },
      },
    });

    res.status(201).json({ offer });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 2️⃣ Get all offers
// ==============================
export const getAllOffers = async (req, res) => {
  try {
    const offers = await prisma.offer.findMany({
      where: { isActive: true },
      include: {
        plan: {
          include: {
            nutrition: {
              select: { id: true, firstName: true, lastName: true, image: true, resume: true },
            },
          },
        },
        nutrition: {
          select: { id: true, firstName: true, lastName: true, image: true, resume: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ offers });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 3️⃣ Get all CONSULTATION offers (for client booking page)
// ==============================
export const getConsultationOffers = async (req, res) => {
  try {
    const offers = await prisma.offer.findMany({
      where: {
        type: "CONSULTATION",
        isActive: true,
      },
      include: {
        nutrition: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            image: true,
            resume: {
              select: {
                bio: true,
                experienceYears: true,
                specializations: true,
                ratingAverage: true,
                education: true,
                workplace: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ offers });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 4️⃣ Get single offer by ID
// ==============================
export const getOfferById = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: {
        plan: true,
        nutrition: {
          select: { id: true, firstName: true, lastName: true, image: true, resume: true },
        },
      },
    });

    if (!offer) return res.status(404).json({ message: "Offer not found" });

    res.json({ offer });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 5️⃣ Get my offers (NUTRITION)
// ==============================
export const getMyOffers = async (req, res) => {
  try {
    const nutritionId = req.user.id;

    const offers = await prisma.offer.findMany({
      where: { nutritionId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({ offers });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 6️⃣ Update Offer (NUTRITION — own only, or ADMIN)
// ==============================
export const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      durationDays,
      hasFreeTrial,
      includesSessions,
      isActive,
    } = req.body;

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    // Ownership check — via nutritionId for CONSULTATION, via plan for PLAN
    const ownerId = offer.nutritionId ?? offer.plan?.nutritionId;
    if (req.user.role !== "ADMIN" && ownerId !== req.user.id)
      return res.status(403).json({ message: "Access forbidden" });

    const updatedOffer = await prisma.offer.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(durationDays !== undefined && { durationDays }),
        ...(hasFreeTrial !== undefined && { hasFreeTrial }),
        ...(includesSessions !== undefined && { includesSessions }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ offer: updatedOffer });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// 7️⃣ Delete Offer (NUTRITION — own only, or ADMIN)
// ==============================
export const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    const ownerId = offer.nutritionId ?? offer.plan?.nutritionId;
    if (req.user.role !== "ADMIN" && ownerId !== req.user.id)
      return res.status(403).json({ message: "Access forbidden" });

    const activeSubscriptions = await prisma.subscription.findFirst({
      where: { offerId: id, status: { in: ["ACTIVE", "PENDING"] } },
    });
    if (activeSubscriptions)
      return res.status(400).json({
        message: "Cannot delete an offer with active or pending subscriptions",
      });

    await prisma.offer.delete({ where: { id } });

    res.json({ message: "Offer deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
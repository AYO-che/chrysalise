import prisma from "../prismaClient.js";

// Create a profile (after signup)
export const createProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { dateOfBirth, gender, weight, height, goal, activityLevel, medicalConditions, allergies } = req.body;

    if (!dateOfBirth || !gender || !weight || !height || !goal || !activityLevel) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    const existingProfile = await prisma.profile.findUnique({ where: { userId } });
    if (existingProfile) {
      return res.status(400).json({ message: "Profile already exists" });
    }

    const profile = await prisma.profile.create({
      data: {
        userId,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        weight,
        height,
        goal,
        activityLevel,
        medicalConditions: medicalConditions ?? [],
        allergies: allergies ?? [],
      },
    });

    res.status(201).json({ profile });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get the current user's profile
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    res.json({ profile });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update the profile
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { dateOfBirth, gender, weight, height, goal, activityLevel, medicalConditions, allergies } = req.body;

    const profile = await prisma.profile.update({
      where: { userId },
      data: {
        ...(dateOfBirth !== undefined && { dateOfBirth: new Date(dateOfBirth) }),
        ...(gender !== undefined && { gender }),
        ...(weight !== undefined && { weight }),
        ...(height !== undefined && { height }),
        ...(goal !== undefined && { goal }),
        ...(activityLevel !== undefined && { activityLevel }),
        ...(medicalConditions !== undefined && { medicalConditions }),
        ...(allergies !== undefined && { allergies }),
      },
    });

    res.json({ profile });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Profile not found" });
    }
    res.status(500).json({ message: "Server error" });
  }
};
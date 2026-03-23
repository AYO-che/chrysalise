import prisma from "../prismaClient.js";

/* =========================
   GET MY RESUME
========================= */
export const getMyResume = async (req, res) => {
  try {
    const resume = await prisma.resume.findUnique({
      where: { userId: req.user.id },
    });

    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    res.json(resume);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   CREATE RESUME
========================= */
export const createResume = async (req, res) => {
  try {
    const existing = await prisma.resume.findUnique({
      where: { userId: req.user.id },
    });

    if (existing) {
      return res.status(400).json({ message: "Resume already exists" });
    }

    const { bio, experienceYears, specializations, certifications } = req.body;

    const resume = await prisma.resume.create({
      data: {
        userId: req.user.id,
        bio,
        experienceYears,
        specializations,
        certifications,
      },
    });

    res.status(201).json(resume);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   UPDATE RESUME
========================= */
export const updateResume = async (req, res) => {
  try {
    const { bio, experienceYears, specializations, certifications } = req.body;

    const resume = await prisma.resume.update({
      where: { userId: req.user.id },
      data: {
        ...(bio !== undefined && { bio }),
        ...(experienceYears !== undefined && { experienceYears }),
        ...(specializations !== undefined && { specializations }),
        ...(certifications !== undefined && { certifications }),
      },
    });

    res.json(resume);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Resume not found" });
    }
    res.status(500).json({ message: "Server error" });
  }
};
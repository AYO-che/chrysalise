// controllers/blogController.js
import prisma from "../prismaClient.js";

const authorSelect = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    image: true,
  },
};

// ==============================
//  Nutritionist creates a blog post (status PENDING)
// ==============================
export const createBlogPost = async (req, res) => {
  try {
    const { title, content, images, videos } = req.body;
    const authorId = req.user.id;

    if (!title || !content)
      return res.status(400).json({ message: "Title and content are required" });

    const post = await prisma.blogPost.create({
      data: {
        title,
        content,
        authorId,
        status: "PENDING",
        images: images ?? [],
        videos: videos ?? [],
      },
    });

    res.status(201).json({ post });
  } catch (err) {
    console.error("Create blog post error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
//  Nutritionist updates own blog post content
// If post was APPROVED, it resets to PENDING for re-review
// ==============================
export const updateBlogPost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { title, content, images, videos } = req.body;

    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Blog post not found" });

    // Ownership check
    if (existing.authorId !== userId)
      return res.status(403).json({ message: "You can only edit your own posts" });

    const data = {
      ...(title && { title }),
      ...(content && { content }),
      ...(images && { images }),
      ...(videos && { videos }),
    };

    // Reset to PENDING if already approved so admin re-reviews the changes
    if (existing.status === "APPROVED") data.status = "PENDING";

    const post = await prisma.blogPost.update({ where: { id }, data });

    res.json({
      message:
        existing.status === "APPROVED"
          ? "Post updated and sent back for re-review"
          : "Post updated successfully",
      post,
    });
  } catch (err) {
    console.error("Update blog post error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
//  Admin approves/rejects a blog post
// ==============================
export const updateBlogStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["APPROVED", "REJECTED"].includes(status))
      return res.status(400).json({ message: "Invalid status. Must be APPROVED or REJECTED" });

    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Blog post not found" });

    const post = await prisma.blogPost.update({ where: { id }, data: { status } });

    res.json({ post });
  } catch (err) {
    console.error("Update blog status error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// Get all approved posts (public)
// ==============================
export const getAllApprovedPosts = async (req, res) => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { status: "APPROVED" },
      include: { author: authorSelect },
      orderBy: { createdAt: "desc" },
    });
    res.json({ posts });
  } catch (err) {
    console.error("Get approved blog posts error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// Get single post by ID
// Public if approved — author and admin can see their own pending/rejected posts
// ==============================
export const getPostById = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await prisma.blogPost.findUnique({
      where: { id },
      include: { author: authorSelect },
    });

    if (!post) return res.status(404).json({ message: "Post not found" });

    if (
      post.status !== "APPROVED" &&
      req.user?.role !== "ADMIN" &&
      req.user?.id !== post.authorId
    )
      return res.status(403).json({ message: "Access forbidden" });

    res.json({ post });
  } catch (err) {
    console.error("Get post by id error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ==============================
// Nutritionist deletes own post (or Admin)
// ==============================
export const deleteBlogPost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await prisma.blogPost.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (req.user.role !== "ADMIN" && req.user.id !== post.authorId)
      return res.status(403).json({ message: "Access forbidden" });

    await prisma.blogPost.delete({ where: { id } });

    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("Delete blog post error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
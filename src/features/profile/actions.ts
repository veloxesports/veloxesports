"use server";

import { prisma } from "@/lib/database/prisma";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { uploadProfileImage } from "@/lib/database/supabase";
import { validateProfileImageFile } from "@/lib/validation/profile-image";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const profileUpdateSchema = z.object({
  veloxUsername: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscores only").optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
});

export async function getPlayerProfile() {
  try {
    const user = await requireCurrentUser();
    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      include: {
        user: true,
      }
    });

    if (!profile) {
      // In a real app we'd trigger creation if missing
      return { success: false, error: "Profile not found" };
    }

    const achievements = await prisma.userAchievement.findMany({
      where: { userId: user.id },
      include: { achievement: true }
    });

    return { success: true, data: { profile, achievements } };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Sign in with Telegram to view your profile." };
    }
    console.error("Error fetching profile", error);
    return { success: false, error: "Failed to fetch profile" };
  }
}

export async function updateCurrentProfile(input: unknown) {
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Choose a 3–24 character username using letters, numbers, or underscores." };
  }

  try {
    const user = await requireCurrentUser();
    const profile = await prisma.userProfile.update({
      where: { userId: user.id },
      data: {
        veloxUsername: parsed.data.veloxUsername || null,
        country: parsed.data.country || null,
      },
    });
    return { success: true, data: profile };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Open VELOX in Telegram to update your profile." };
    }
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return { success: false, error: "That VELOX username is already taken." };
    }
    console.error("Profile update failed", error);
    return { success: false, error: "We couldn't save your profile. Please try again." };
  }
}

export async function uploadCurrentProfileImage(formData: FormData) {
  const file = formData.get("profileImage");
  if (!validateProfileImageFile(file)) {
    return { success: false, error: "Upload a JPG, PNG, or WebP image smaller than 2 MB." };
  }

  try {
    const user = await requireCurrentUser();
    const profileImage = await uploadProfileImage(user.id, file);
    await prisma.user.update({
      where: { id: user.id },
      data: { profileImage },
      select: { profileImage: true },
    });
    revalidatePath("/profile");
    revalidatePath("/settings");
    return { success: true, data: { profileImage } };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Open VELOX in Telegram to update your profile image." };
    }
    if (error instanceof Error && error.message === "SUPABASE_STORAGE_NOT_CONFIGURED") {
      return { success: false, error: "Profile image storage has not been configured yet." };
    }
    if (error instanceof Error && error.message === "PROFILE_IMAGE_UPLOAD_FAILED") {
      return { success: false, error: "We couldn't upload your image. Please try again." };
    }
    console.error("Profile image upload failed", error);
    return { success: false, error: "We couldn't save your profile image. Please try again." };
  }
}

export async function disconnectDiscord() {
  try {
    const user = await requireCurrentUser();
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: { discordId: null, discordUsername: null, discordAvatarUrl: null },
    });
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Open VELOX in Telegram to update your connections." };
    }
    console.error("Discord disconnect failed", error);
    return { success: false, error: "We couldn't disconnect Discord. Please try again." };
  }
}

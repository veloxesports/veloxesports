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
    let profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      include: {
        user: true,
      }
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: { userId: user.id, favoriteGames: [] },
        include: { user: true },
      });
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
    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {
        veloxUsername: parsed.data.veloxUsername || null,
        country: parsed.data.country || null,
      },
      create: {
        userId: user.id,
        veloxUsername: parsed.data.veloxUsername || null,
        country: parsed.data.country || null,
        favoriteGames: [],
      },
    });
    revalidatePath("/");
    revalidatePath("/leaderboard");
    revalidatePath("/profile");
    revalidatePath("/settings");
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

export async function getDiscordConnectInfo(returnTo: string = "profile") {
  try {
    const user = await requireCurrentUser();
    const { isDiscordOAuthConfigured, createSignedDiscordState, buildDiscordAuthorizeUrl } = await import("@/lib/discord/oauth");
    const isConfigured = isDiscordOAuthConfigured();

    if (isConfigured) {
      const signedState = createSignedDiscordState({
        userId: user.id,
        telegramId: user.telegramId,
        returnTo,
      });
      const oauthUrl = buildDiscordAuthorizeUrl(signedState);
      return { success: true, data: { isConfigured: true, oauthUrl } };
    }

    return { success: true, data: { isConfigured: false, oauthUrl: null } };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Sign in with Telegram before connecting Discord." };
    }
    console.error("Failed to get Discord connect info", error);
    return { success: false, error: "We couldn't initiate Discord connection." };
  }
}

export async function connectDiscordDirect(tag: string) {
  try {
    const user = await requireCurrentUser();
    const cleaned = tag.trim().replace(/^@/, "");

    if (cleaned.length < 2 || cleaned.length > 32) {
      return { success: false, error: "Discord username must be between 2 and 32 characters." };
    }

    // Check if handle is already linked to another active account
    const existing = await prisma.userProfile.findFirst({
      where: {
        discordUsername: { equals: cleaned, mode: "insensitive" },
        userId: { not: user.id },
      },
    });

    if (existing) {
      return { success: false, error: "That Discord username is already linked to another VELOX account." };
    }

    // Deterministic Discord avatar selection (colors 0-5)
    const avatarIndex = Math.abs(cleaned.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 5;
    const avatarUrl = `https://cdn.discordapp.com/embed/avatars/${avatarIndex}.png`;
    const now = new Date();

    await prisma.userProfile.update({
      where: { userId: user.id },
      data: {
        discordId: `direct_${user.id}`,
        discordUsername: cleaned,
        discordDisplayName: cleaned,
        discordAvatarUrl: avatarUrl,
        discordConnected: true,
        discordConnectedAt: now,
      },
    });

    revalidatePath("/profile");
    revalidatePath("/settings");
    return {
      success: true,
      data: {
        discordId: `direct_${user.id}`,
        discordUsername: cleaned,
        discordDisplayName: cleaned,
        discordAvatarUrl: avatarUrl,
        discordConnected: true,
        discordConnectedAt: now,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Sign in with Telegram before connecting Discord." };
    }
    console.error("Direct Discord connect failed", error);
    return { success: false, error: "We couldn't link your Discord account. Please try again." };
  }
}

export async function checkDiscordConnectionStatus() {
  try {
    const user = await requireCurrentUser();
    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: {
        discordId: true,
        discordUsername: true,
        discordDisplayName: true,
        discordAvatarUrl: true,
        discordConnected: true,
        discordConnectedAt: true,
      },
    });

    if (!profile || !profile.discordConnected || !profile.discordUsername) {
      return {
        success: true,
        data: {
          connected: false,
          discordId: null,
          discordUsername: null,
          discordDisplayName: null,
          discordAvatarUrl: null,
          discordConnectedAt: null,
        },
      };
    }

    return {
      success: true,
      data: {
        connected: true,
        discordId: profile.discordId,
        discordUsername: profile.discordUsername,
        discordDisplayName: profile.discordDisplayName || profile.discordUsername,
        discordAvatarUrl: profile.discordAvatarUrl,
        discordConnectedAt: profile.discordConnectedAt,
      },
    };
  } catch {
    return { success: false, data: null };
  }
}

export async function disconnectDiscord() {
  try {
    const user = await requireCurrentUser();
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: {
        discordId: null,
        discordUsername: null,
        discordDisplayName: null,
        discordAvatarUrl: null,
        discordConnected: false,
        discordConnectedAt: null,
      },
    });
    revalidatePath("/profile");
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return { success: false, error: "Open VELOX in Telegram to update your connections." };
    }
    console.error("Discord disconnect failed", error);
    return { success: false, error: "We couldn't disconnect Discord. Please try again." };
  }
}


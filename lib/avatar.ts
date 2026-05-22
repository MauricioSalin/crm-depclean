import { buildApiFileUrl } from "@/lib/api/client"

export function resolveAvatarUrl(avatar?: string | null) {
  if (!avatar) return "/professional-avatar.jpg"
  if (avatar === "/professional-avatar.jpg") return avatar
  if (/^\/api\/v\d+\/files\//i.test(avatar) || /^\/files\//i.test(avatar)) {
    return buildApiFileUrl(avatar)
  }
  return avatar
}

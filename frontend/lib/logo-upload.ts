import { api } from "@/lib/api";

function sanitizeFileExtension(file: File) {
  const fallback = file.type.split("/")[1] || "png";
  const raw = file.name.split(".").pop() || fallback;
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "") || "png";
}

export async function uploadLogoFile(file: File, storageKey: string) {
  const ext = sanitizeFileExtension(file);
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("storage_key", storageKey);
  formData.append("extension", ext);

  const result = await api.postForm<{ public_url: string }>("/api/admin/tenants/logo-upload", formData);
  return result.public_url;
}

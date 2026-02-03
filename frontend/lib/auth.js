import { apiGet, apiPost } from "./api";

export async function getCurrentUser() {
  try {
    const data = await apiGet("/auth/me");
    return data.user || null;
  } catch (err) {
    return null;
  }
}

export async function login(username, password) {
  return apiPost("/auth/login", { username, password });
}

export async function logout() {
  return apiPost("/auth/logout", {});
}

export async function requireAuth(router) {
  const user = await getCurrentUser();
  if (!user) {
    router.replace("/");
    return null;
  }
  return user;
}

import axios from "axios";

const BASE = "https://api.linode.com/v4";

export function linodeClient(token: string) {
  return axios.create({
    baseURL: BASE,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export function getToken(req: { headers: Record<string, string | string[] | undefined> }): string {
  const auth = req.headers["x-linode-token"];
  if (!auth || typeof auth !== "string") {
    throw new Error("Missing X-Linode-Token header");
  }
  return auth;
}
